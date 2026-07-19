use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32)]
pub struct Shatter<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == owner.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
        close = owner,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        mut,
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// EVO owner — receives locked SOL minus shatter fee
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Collection creator — may receive shatter fee
    /// CHECK: Verified by collection_config.creator
    #[account(mut, address = collection_config.creator)]
    pub creator: SystemAccount<'info>,

    /// Protocol treasury — verified against protocol_config.treasury
    /// CHECK: Verified by address constraint
    #[account(mut, address = protocol_config.treasury)]
    pub treasury: Option<UncheckedAccount<'info>>,

    /// Incinerator — used when fee destination is Burn.
    /// May be the real Solana incinerator or a custom burn destination
    /// (if collection.burn_destination != Pubkey::default()).
    /// CHECK: Verified at runtime against collection.burn_destination
    #[account(mut)]
    pub incinerator: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn shatter(ctx: Context<Shatter>, evo_id: u32) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &mut ctx.accounts.collection_config;

    // Verify reserve invariant BEFORE any mutation
    verify_reserve_invariant(&evo.to_account_info(), evo.locked_lamports)?;

    let locked = evo.locked_lamports;
    let fee = calculate_fee(locked, collection.shatter_fee_bps);

    // Mark as shattered BEFORE any lamport movement (prevents re-entrancy)
    evo.is_shattered = true;
    evo.locked_lamports = 0;

    // Decrement live supply — the EVO is being destroyed.
    // This allows close_collection to work after all EVOs are shattered.
    collection.current_supply = collection
        .current_supply
        .checked_sub(1)
        .ok_or(EvoError::MathOverflow)?;

    // Move the fee out of the EVO PDA using direct lamport manipulation.
    // System Program transfer CPI does NOT work on program-owned accounts.
    let evo_info = evo.to_account_info();

    if fee > 0 {
        match collection.shatter_fee_destination {
            FeeDestination::Creator => {
                transfer_lamports(
                    &evo_info,
                    &ctx.accounts.creator.to_account_info(),
                    fee,
                )?;
            }
            FeeDestination::Treasury => {
                let treasury = ctx.accounts.treasury.as_ref()
                    .ok_or(EvoError::MissingTreasury)?;
                transfer_lamports(
                    &evo_info,
                    &treasury.to_account_info(),
                    fee,
                )?;
            }
            FeeDestination::Burn => {
                let burn_dest = if collection.burn_destination == Pubkey::default() {
                    INCINERATOR
                } else {
                    collection.burn_destination
                };
                require!(
                    ctx.accounts.incinerator.key() == burn_dest,
                    EvoError::InvalidBurnDestination
                );
                // Prevent burn destination from being a program-owned PDA
                // (stops creator from reclaiming "burned" fees via close_collection)
                require!(
                    ctx.accounts.incinerator.owner != &crate::ID,
                    EvoError::BurnDestinationIsProgramPda
                );
                transfer_lamports(
                    &evo_info,
                    &ctx.accounts.incinerator.to_account_info(),
                    fee,
                )?;
                msg!("Burned {} lamports to burn destination", fee);
            }
            FeeDestination::Split => {
                let treasury = ctx.accounts.treasury.as_ref()
                    .ok_or(EvoError::MissingTreasury)?;
                let half = fee / 2;
                let other_half = fee
                    .checked_sub(half)
                    .ok_or(EvoError::MathOverflow)?;

                transfer_lamports(
                    &evo_info,
                    &ctx.accounts.creator.to_account_info(),
                    half,
                )?;
                transfer_lamports(
                    &evo_info,
                    &treasury.to_account_info(),
                    other_half,
                )?;
            }
        }
    }

    // close = owner sends remaining lamports (reserve - fee + rent + any surplus) to owner.
    msg!(
        "EVO #{} shattered. Returned {} lamports to owner. Fee: {} lamports.",
        evo_id, locked - fee, fee
    );
    Ok(())
}

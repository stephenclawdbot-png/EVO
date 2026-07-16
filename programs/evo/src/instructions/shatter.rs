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
        close = owner,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    /// EVO owner — receives locked SOL minus shatter fee
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Collection creator — may receive shatter fee
    /// CHECK: Verified by collection_config.creator
    #[account(mut, address = collection_config.creator)]
    pub creator: SystemAccount<'info>,

    /// Protocol treasury — optional, used when destination == Treasury or Split
    /// CHECK: Optional, only used when destination == Treasury or Split
    #[account(mut)]
    pub treasury: Option<UncheckedAccount<'info>>,

    /// Incinerator — used when fee destination is Burn
    /// CHECK: Verified against INCINERATOR constant
    #[account(mut, address = INCINERATOR)]
    pub incinerator: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn shatter(ctx: Context<Shatter>, evo_id: u32) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection_config;

    let locked = evo.locked_lamports;
    let fee = calculate_fee(locked, collection.shatter_fee_bps);
    let owner_proceeds = locked - fee;

    // Mark as shattered BEFORE any lamport movement (prevents re-entrancy)
    evo.is_shattered = true;
    evo.locked_lamports = 0;

    // Move the fee out of the EVO PDA using direct lamport manipulation.
    // System Program transfer CPI does NOT work on program-owned accounts.
    // The EVO PDA is owned by the EVO program, so we must debit/credit lamports directly.
    if fee > 0 {
        let evo_info = evo.to_account_info();
        match collection.shatter_fee_destination {
            FeeDestination::Creator => {
                **evo_info.lamports.borrow_mut() -= fee;
                **ctx.accounts.creator.to_account_info().lamports.borrow_mut() += fee;
            }
            FeeDestination::Treasury => {
                let treasury = ctx.accounts.treasury.as_ref()
                    .ok_or(EvoError::CollectionInactive)?;
                **evo_info.lamports.borrow_mut() -= fee;
                **treasury.to_account_info().lamports.borrow_mut() += fee;
            }
            FeeDestination::Burn => {
                let incinerator = ctx.accounts.incinerator.as_ref()
                    .ok_or(EvoError::IncineratorRequired)?;
                **evo_info.lamports.borrow_mut() -= fee;
                **incinerator.to_account_info().lamports.borrow_mut() += fee;
            }
            FeeDestination::Split => {
                let half = fee / 2;
                let other_half = fee - half;
                let creator_info = ctx.accounts.creator.to_account_info();

                // Creator always gets their half
                **evo_info.lamports.borrow_mut() -= half;
                **creator_info.lamports.borrow_mut() += half;

                // Treasury gets the other half, or creator gets it if no treasury supplied
                if let Some(treasury) = ctx.accounts.treasury.as_ref() {
                    **evo_info.lamports.borrow_mut() -= other_half;
                    **treasury.to_account_info().lamports.borrow_mut() += other_half;
                } else {
                    **evo_info.lamports.borrow_mut() -= other_half;
                    **creator_info.lamports.borrow_mut() += other_half;
                }
            }
        }
    }

    // close = owner sends remaining lamports (owner_proceeds + rent + any surplus) to owner.
    msg!(
        "EVO #{} shattered. Returned {} lamports to owner. Fee: {} lamports.",
        evo_id, owner_proceeds, fee
    );
    Ok(())
}

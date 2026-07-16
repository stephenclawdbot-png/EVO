use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

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

    /// Protocol treasury — may receive shatter fee
    /// CHECK: Optional, only used when destination == Treasury
    #[account(mut)]
    pub treasury: Option<SystemAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn shatter(ctx: Context<Shatter>, evo_id: u32) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection_config;

    let locked = evo.locked_lamports;
    let fee = calculate_fee(locked, collection.shatter_fee_bps);
    let owner_proceeds = locked - fee;

    // Mark as shattered BEFORE transferring (prevents re-entrancy)
    evo.is_shattered = true;
    evo.locked_lamports = 0;

    // PDA signer seeds for the EVO account
    let collection_key = collection.key();
    let evo_id_bytes = evo_id.to_le_bytes();
    let bump = [evo.bump];
    let evo_seeds: Vec<&[u8]> = vec![
        EVO_SEED,
        collection_key.as_ref(),
        &evo_id_bytes,
        &bump,
    ];
    let signer = &[evo_seeds.as_slice()];

    // Transfer the fee from the EVO PDA to the destination
    if fee > 0 {
        match collection.shatter_fee_destination {
            FeeDestination::Creator => {
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: evo.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                    signer,
                );
                transfer(cpi_ctx, fee)?;
            }
            FeeDestination::Treasury => {
                let treasury = ctx.accounts.treasury.as_ref().ok_or(EvoError::CollectionInactive)?;
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: evo.to_account_info(),
                        to: treasury.to_account_info(),
                    },
                    signer,
                );
                transfer(cpi_ctx, fee)?;
            }
            FeeDestination::Burn => {
                msg!("Burned {} lamports (fee not routed to any recipient)", fee);
            }
            FeeDestination::Split => {
                let half = fee / 2;
                let other_half = fee - half;

                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: evo.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                    signer,
                );
                transfer(cpi_ctx, half)?;

                if let Some(treasury) = ctx.accounts.treasury.as_ref() {
                    let cpi_ctx = CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        Transfer {
                            from: evo.to_account_info(),
                            to: treasury.to_account_info(),
                        },
                        signer,
                    );
                    transfer(cpi_ctx, other_half)?;
                }

                msg!("Split fee: {} to creator, {} to treasury", half, other_half);
            }
        }
    }

    // close=owner transfers remaining lamports (locked - fee + rent) to owner.

    msg!("EVO #{} shattered. Returned {} lamports to owner. Fee: {} lamports.", evo_id, owner_proceeds, fee);
    Ok(())
}

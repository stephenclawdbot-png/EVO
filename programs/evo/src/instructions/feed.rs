use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
#[instruction(evo_id: u32, additional_lamports: u64)]
pub struct Feed<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == feeder.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(mut)]
    pub feeder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn feed(ctx: Context<Feed>, evo_id: u32, additional_lamports: u64) -> Result<()> {
    require!(additional_lamports > 0, EvoError::InsufficientLamports);

    let evo = &mut ctx.accounts.evo;

    // Transfer SOL from feeder to the EVO PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.feeder.to_account_info(),
            to: evo.to_account_info(),
        },
    );
    transfer(cpi_ctx, additional_lamports)?;

    evo.locked_lamports = evo
        .locked_lamports
        .checked_add(additional_lamports)
        .ok_or(EvoError::MathOverflow)?;
    evo.total_fed_lamports = evo
        .total_fed_lamports
        .checked_add(additional_lamports)
        .ok_or(EvoError::MathOverflow)?;
    evo.feed_count = evo
        .feed_count
        .checked_add(1)
        .ok_or(EvoError::MathOverflow)?;

    // Defense-in-depth: verify reserve invariant after feed
    verify_reserve_invariant(&evo.to_account_info(), evo.locked_lamports)?;

    msg!("Fed {} lamports to EVO. Total locked: {}", additional_lamports, evo.locked_lamports);
    Ok(())
}
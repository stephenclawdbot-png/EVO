use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
pub struct Feed<'info> {
    #[account(
        mut,
        constraint = evo.owner == feeder.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(mut)]
    pub feeder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn feed(ctx: Context<Feed>, additional_lamports: u64) -> Result<()> {
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

    msg!("Fed {} lamports to EVO. Total locked: {}", additional_lamports, evo.locked_lamports);
    Ok(())
}
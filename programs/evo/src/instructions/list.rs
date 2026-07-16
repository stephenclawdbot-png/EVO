use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct List<'info> {
    #[account(
        mut,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = !evo.is_listed @ EvoError::EvoAlreadyListed,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn list(ctx: Context<List>, price_lamports: u64) -> Result<()> {
    require!(price_lamports > 0, EvoError::InsufficientLamports);

    let evo = &mut ctx.accounts.evo;
    evo.is_listed = true;
    evo.list_price_lamports = price_lamports;

    msg!("EVO listed for {} lamports", price_lamports);
    Ok(())
}
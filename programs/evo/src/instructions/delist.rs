use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(
        mut,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = evo.is_listed @ EvoError::EvoNotListed,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn delist(ctx: Context<Delist>) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!("EVO delisted");
    Ok(())
}
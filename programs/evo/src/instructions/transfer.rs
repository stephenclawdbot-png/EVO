use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        mut,
        constraint = evo.owner == current_owner.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(mut)]
    pub current_owner: Signer<'info>,
}

pub fn transfer(ctx: Context<Transfer>, new_owner: Pubkey) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    evo.owner = new_owner;
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!("EVO transferred from {} to {}", ctx.accounts.current_owner.key(), new_owner);
    Ok(())
}
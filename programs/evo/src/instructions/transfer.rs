use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32, new_owner: Pubkey)]
pub struct Transfer<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == current_owner.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(mut)]
    pub current_owner: Signer<'info>,
}

pub fn transfer(ctx: Context<Transfer>, evo_id: u32, new_owner: Pubkey) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    evo.owner = new_owner;
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!("EVO transferred from {} to {}", ctx.accounts.current_owner.key(), new_owner);
    Ok(())
}
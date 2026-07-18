use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32)]
pub struct Delist<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = evo.is_listed @ EvoError::EvoNotListed,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn delist(ctx: Context<Delist>, evo_id: u32) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!("EVO delisted");
    Ok(())
}
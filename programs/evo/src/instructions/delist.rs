use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32)]
pub struct Delist<'info> {
    #[account(
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        mut,
        seeds = [LISTING_SEED, evo.key().as_ref()],
        bump = listing.bump,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn delist(_ctx: Context<Delist>, _evo_id: u32) -> Result<()> {
    msg!("EVO delisted");
    Ok(())
}
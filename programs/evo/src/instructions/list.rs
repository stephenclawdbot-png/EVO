use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32, price_lamports: u64)]
pub struct List<'info> {
    #[account(
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        init,
        payer = seller,
        space = Listing::SPACE,
        seeds = [LISTING_SEED, evo.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn list(ctx: Context<List>, evo_id: u32, price_lamports: u64) -> Result<()> {
    require!(price_lamports > 0, EvoError::InsufficientLamports);

    let listing = &mut ctx.accounts.listing;
    listing.evo = ctx.accounts.evo.key();
    listing.seller = ctx.accounts.seller.key();
    listing.price_lamports = price_lamports;
    listing.bump = ctx.bumps.listing;

    msg!("EVO listed for {} lamports", price_lamports);
    Ok(())
}
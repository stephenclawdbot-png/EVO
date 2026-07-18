use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(evo_id: u32, price_lamports: u64)]
pub struct List<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == seller.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = !evo.is_listed @ EvoError::EvoAlreadyListed,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
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

pub fn list(ctx: Context<List>, evo_id: u32, price_lamports: u64) -> Result<()> {
    require!(price_lamports > 0, EvoError::InsufficientLamports);

    let evo = &mut ctx.accounts.evo;
    evo.is_listed = true;
    evo.list_price_lamports = price_lamports;

    msg!("EVO listed for {} lamports", price_lamports);
    Ok(())
}
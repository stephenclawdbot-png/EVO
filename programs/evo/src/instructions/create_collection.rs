use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateCollection<'info> {
    #[account(
        init,
        payer = payer,
        space = CollectionConfig::SPACE,
        seeds = [COLLECTION_SEED, name.as_bytes()],
        bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Treasury wallet — receives the creation fee
    /// CHECK: Verified by protocol_config.treasury
    #[account(mut, address = protocol_config.treasury)]
    pub treasury: SystemAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_collection(
    ctx: Context<CreateCollection>,
    name: String,
    supply_cap: u32,
    shatter_fee_bps: u16,
    shatter_fee_destination: FeeDestination,
    trade_royalty_bps: u16,
    royalty_destination: FeeDestination,
    mint_price_lamports: u64,
    lock_amount_lamports: u64,
    metadata_uri: String,
) -> Result<()> {
    require!(protocol_is_initialized(&ctx.accounts.protocol_config), EvoError::ProtocolNotInitialized);
    require!(name.len() <= MAX_COLLECTION_NAME_LEN, EvoError::CollectionNameTooLong);
    require!(shatter_fee_bps <= MAX_SHATTER_FEE_BPS, EvoError::ShatterFeeTooHigh);
    require!(trade_royalty_bps <= MAX_ROYALTY_BPS, EvoError::RoyaltyTooHigh);
    require!(lock_amount_lamports > 0, EvoError::InsufficientLamports);
    require!(metadata_uri.len() <= MAX_METADATA_URI_LEN, EvoError::MetadataUriTooLong);

    let config = &mut ctx.accounts.collection_config;

    config.name = name.clone();
    config.creator = ctx.accounts.payer.key();
    config.supply_cap = supply_cap;
    config.current_supply = 0;
    config.shatter_fee_bps = shatter_fee_bps;
    config.shatter_fee_destination = shatter_fee_destination;
    config.trade_royalty_bps = trade_royalty_bps;
    config.royalty_destination = royalty_destination;
    config.mint_price_lamports = mint_price_lamports;
    config.lock_amount_lamports = lock_amount_lamports;
    config.bump = ctx.bumps.collection_config;
    config.metadata_uri = metadata_uri;

    // Pay the collection creation fee to the treasury
    let fee = ctx.accounts.protocol_config.creation_fee_lamports;
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    transfer(cpi_ctx, fee)?;

    msg!("Collection '{}' created by {}. Fee: {} lamports", name, ctx.accounts.payer.key(), fee);
    Ok(())
}
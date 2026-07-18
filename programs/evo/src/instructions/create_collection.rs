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
    lifecycle: LifecycleParams,
) -> Result<()> {
    require!(protocol_is_initialized(&ctx.accounts.protocol_config), EvoError::ProtocolNotInitialized);
    require!(name.len() <= MAX_COLLECTION_NAME_LEN, EvoError::CollectionNameTooLong);
    require!(name.len() > 0, EvoError::CollectionNameTooLong);
    require!(supply_cap >= 1, EvoError::SupplyCapTooLow);
    require!(supply_cap <= MAX_SUPPLY_CEILING, EvoError::SupplyCapTooHigh);
    require!(shatter_fee_bps <= MAX_SHATTER_FEE_BPS, EvoError::ShatterFeeTooHigh);
    require!(trade_royalty_bps <= MAX_ROYALTY_BPS, EvoError::RoyaltyTooHigh);
    require!(lock_amount_lamports > 0, EvoError::InsufficientLamports);
    require!(metadata_uri.len() <= MAX_METADATA_URI_LEN, EvoError::MetadataUriTooLong);

    // Validate lifecycle config.
    // RevealAndEvolve/Custom must declare max_states > 0.
    // Reveal/CommitReveal/RevealAndEvolve/Custom must set a reveal_authority.
    if lifecycle.lifecycle_type == LifecycleType::RevealAndEvolve
        || lifecycle.lifecycle_type == LifecycleType::Custom
    {
        require!(lifecycle.max_states > 0, EvoError::InvalidLifecycleConfig);
    }
    if lifecycle.lifecycle_type == LifecycleType::Reveal
        || lifecycle.lifecycle_type == LifecycleType::CommitReveal
        || lifecycle.lifecycle_type == LifecycleType::RevealAndEvolve
        || lifecycle.lifecycle_type == LifecycleType::Custom
    {
        require!(
            lifecycle.reveal_authority != Pubkey::default(),
            EvoError::InvalidLifecycleConfig
        );
    }

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

    // Lifecycle
    config.lifecycle_type = lifecycle.lifecycle_type;
    config.max_states = lifecycle.max_states;
    config.reveal_authority = lifecycle.reveal_authority;
    config.reveal_entropy = [0u8; 32];
    config.is_revealed = false;
    config.evolve_trade_threshold = lifecycle.evolve_trade_threshold;
    config.evolve_feed_threshold = lifecycle.evolve_feed_threshold;
    config.evolve_hold_seconds = lifecycle.evolve_hold_seconds;
    config.evolve_locked_threshold = lifecycle.evolve_locked_threshold;
    config.transition_policy_hash = lifecycle.transition_policy_hash;

    // Randomness
    config.randomness_policy = lifecycle.randomness_policy;
    config.manifest_root = lifecycle.manifest_root;
    config.reveal_commitment = [0u8; 32];

    // Configurable burn destination — must NOT be:
    //   1. The creator's wallet (prevents "burn" fees routed back to creator)
    //   2. The collection PDA itself (prevents reclaiming burned fees via close_collection)
    //   3. The protocol PDA (same vector via future protocol instructions)
    if lifecycle.burn_destination != Pubkey::default() {
        require!(
            lifecycle.burn_destination != ctx.accounts.payer.key(),
            EvoError::InvalidBurnDestination
        );
        require!(
            lifecycle.burn_destination != ctx.accounts.collection_config.key(),
            EvoError::BurnDestinationIsProgramPda
        );
        require!(
            lifecycle.burn_destination != ctx.accounts.protocol_config.key(),
            EvoError::BurnDestinationIsProgramPda
        );
    }
    config.burn_destination = lifecycle.burn_destination;

    // Artwork manifest integrity hash
    config.artwork_manifest_hash = lifecycle.artwork_manifest_hash;

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
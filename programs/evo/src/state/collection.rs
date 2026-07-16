use crate::constants::MAX_METADATA_URI_LEN;
use crate::state::{FeeDestination, LifecycleType, RandomnessPolicy};
use anchor_lang::prelude::*;

/// Collection configuration. Created by anyone who pays the creation fee.
/// PDA: ["collection", name] + program_id
#[account]
pub struct CollectionConfig {
    pub name: String,
    pub creator: Pubkey,
    pub supply_cap: u32,
    pub current_supply: u32,
    pub shatter_fee_bps: u16,
    pub shatter_fee_destination: FeeDestination,
    pub trade_royalty_bps: u16,
    pub royalty_destination: FeeDestination,
    pub mint_price_lamports: u64,
    pub lock_amount_lamports: u64,
    pub bump: u8,
    pub metadata_uri: String,

    // --- Lifecycle ---
    pub lifecycle_type: LifecycleType,
    pub max_states: u16,
    pub reveal_authority: Pubkey,
    pub reveal_entropy: [u8; 32],
    pub is_revealed: bool,

    // --- Evolution thresholds (per stage, 0 = disabled, AND logic) ---
    pub evolve_trade_threshold: u32,
    pub evolve_feed_threshold: u64,
    pub evolve_hold_seconds: i64,
    pub evolve_locked_threshold: u64,
    pub transition_policy_hash: [u8; 32],

    // --- Randomness ---
    pub randomness_policy: RandomnessPolicy,
    pub manifest_root: [u8; 32],
}

impl CollectionConfig {
    pub const SPACE: usize = 8 + // discriminator
        4 + 32 + // name
        32 +     // creator
        4 +      // supply_cap
        4 +      // current_supply
        2 +      // shatter_fee_bps
        1 +      // shatter_fee_destination
        2 +      // trade_royalty_bps
        1 +      // royalty_destination
        8 +      // mint_price_lamports
        8 +      // lock_amount_lamports
        1 +      // bump
        4 + MAX_METADATA_URI_LEN + // metadata_uri
        // Lifecycle:
        1 +      // lifecycle_type
        2 +      // max_states
        32 +     // reveal_authority
        32 +     // reveal_entropy
        1 +      // is_revealed
        4 +      // evolve_trade_threshold
        8 +      // evolve_feed_threshold
        8 +      // evolve_hold_seconds
        8 +      // evolve_locked_threshold
        32 +     // transition_policy_hash
        // Randomness:
        1 +      // randomness_policy
        32;      // manifest_root
}

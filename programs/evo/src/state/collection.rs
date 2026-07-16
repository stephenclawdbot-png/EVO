use crate::state::FeeDestination;
use anchor_lang::prelude::*;

/// Collection configuration. Created by anyone who pays the creation fee.
/// PDA: ["collection", name] + program_id
#[account]
pub struct CollectionConfig {
    /// Collection name (e.g., "Z", "Cats")
    pub name: String,
    /// Creator of the collection
    pub creator: Pubkey,
    /// Maximum number of EVOs that can be forged
    pub supply_cap: u32,
    /// Current number of EVOs forged
    pub current_supply: u32,
    /// Shatter fee in basis points (100 = 1%)
    pub shatter_fee_bps: u16,
    /// Where the shatter fee goes
    pub shatter_fee_destination: FeeDestination,
    /// Trade royalty in basis points (100 = 1%)
    pub trade_royalty_bps: u16,
    /// Where the royalty goes
    pub royalty_destination: FeeDestination,
    /// Bump seed
    pub bump: u8,
}

impl CollectionConfig {
    pub const SPACE: usize = 8 + // discriminator
        4 + 32 + // name (String: 4 len prefix + 32 max chars)
        32 +     // creator
        4 +      // supply_cap
        4 +      // current_supply
        2 +      // shatter_fee_bps
        1 +      // shatter_fee_destination (enum)
        2 +      // trade_royalty_bps
        1 +      // royalty_destination (enum)
        1;       // bump
}
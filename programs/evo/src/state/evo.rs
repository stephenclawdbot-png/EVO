use anchor_lang::prelude::*;

/// A fracture line — a permanent scar from a trade.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct FractureLine {
    pub trade_number: u32,
    pub previous_owner: Pubkey,
    pub timestamp: i64,
    pub position: u16,
    pub intensity: u8,
}

/// An EVO — Evolving Value Object.
/// PDA: ["evo", collection_pda, evo_id_le] + program_id
#[account]
pub struct EVOAccount {
    pub collection: Pubkey,
    pub owner: Pubkey,
    pub locked_lamports: u64,
    pub forged_at: i64,
    pub facet_count: u32,
    pub trade_count: u32,
    pub resonance_seed: [u8; 32],
    pub fracture_lines: Vec<FractureLine>,
    pub is_listed: bool,
    pub list_price_lamports: u64,
    pub is_shattered: bool,
    pub bump: u8,

    // --- Lifecycle state ---
    pub mint_index: u32,
    pub current_state: u16,
    pub last_transition_at: i64,
    pub feed_count: u32,
    pub total_fed_lamports: u64,

    /// Whether this EVO's metadata has been verified against the
    /// collection's `manifest_root` Merkle tree via `verify_merkle_proof`.
    pub manifest_verified: bool,
}

impl EVOAccount {
    /// Each FractureLine: 4 + 32 + 8 + 2 + 1 = 47 bytes
    pub const SPACE: usize = 8 + // discriminator
        32 +     // collection
        32 +     // owner
        8 +      // locked_lamports
        8 +      // forged_at
        4 +      // facet_count
        4 +      // trade_count
        32 +     // resonance_seed
        4 + (47 * 20) + // fracture_lines
        1 +      // is_listed
        8 +      // list_price_lamports
        1 +      // is_shattered
        1 +      // bump
        // Lifecycle state:
        4 +      // mint_index
        2 +      // current_state
        8 +      // last_transition_at
        4 +      // feed_count
        8 +      // total_fed_lamports
        1;       // manifest_verified
}

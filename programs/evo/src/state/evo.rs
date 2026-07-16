use anchor_lang::prelude::*;

/// A fracture line — a permanent scar from a trade.
/// Each trade adds one fracture line to the EVO.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct FractureLine {
    /// Which trade number caused this fracture
    pub trade_number: u32,
    /// Previous owner (truncated to Pubkey)
    pub previous_owner: Pubkey,
    /// Timestamp of the trade
    pub timestamp: i64,
    /// Position angle (0-360 degrees)
    pub position: u16,
    /// Intensity (0-100)
    pub intensity: u8,
}

/// An EVO — Evolving Value Object.
/// PDA: ["evo", collection_pda, evo_id_le] + program_id
#[account]
pub struct EVOAccount {
    /// Collection this EVO belongs to
    pub collection: Pubkey,
    /// Current owner
    pub owner: Pubkey,
    /// Locked SOL in lamports (this is the floor price)
    pub locked_lamports: u64,
    /// When the EVO was forged (unix timestamp)
    pub forged_at: i64,
    /// Number of facets (grows over time — represents evolution)
    pub facet_count: u32,
    /// Number of trades (each adds a fracture line)
    pub trade_count: u32,
    /// Resonance seed — drives generative art rendering
    pub resonance_seed: [u8; 32],
    /// Fracture lines from trades (max 20)
    pub fracture_lines: Vec<FractureLine>,
    /// Whether the EVO is listed for sale
    pub is_listed: bool,
    /// List price in lamports (if listed)
    pub list_price_lamports: u64,
    /// Whether the EVO has been shattered (permanently destroyed)
    pub is_shattered: bool,
    /// Bump seed
    pub bump: u8,
}

impl EVOAccount {
    /// Base space + space for max 20 fracture lines
    /// Each FractureLine: 4 + 32 + 8 + 2 + 1 = 47 bytes
    pub const SPACE: usize = 8 + // discriminator
        32 +     // collection
        32 +     // owner
        8 +      // locked_lamports
        8 +      // forged_at
        4 +      // facet_count
        4 +      // trade_count
        32 +     // resonance_seed
        4 + (47 * 20) + // fracture_lines (Vec: 4 len prefix + 20 * 47)
        1 +      // is_listed
        8 +      // list_price_lamports
        1 +      // is_shattered
        1;       // bump
}
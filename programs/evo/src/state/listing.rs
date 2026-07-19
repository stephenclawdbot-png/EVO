use anchor_lang::prelude::*;

/// A listing — a separate PDA that records an EVO is for sale.
///
/// PDA: ["listing", evo_pda] + program_id
///
/// This is a **reference marketplace** listing. The core EVO protocol
/// is marketplace-neutral: `transfer` and `shatter` work regardless of
/// whether a listing exists. Third-party marketplaces can build their
/// own listing/escrow programs on top of the neutral `transfer` instruction.
///
/// Stale listing handling: if the EVO is transferred (via `transfer` or `buy`)
/// the listing's `seller` may no longer match `evo.owner`. In that case:
/// - `buy` checks `listing.seller == evo.owner` and fails if they don't match.
/// - `delist` checks `evo.owner == signer` so the new owner can close the stale listing.
#[account]
pub struct Listing {
    /// The EVO PDA being listed.
    pub evo: Pubkey,
    /// The seller (EVO owner at time of listing).
    pub seller: Pubkey,
    /// Sale price in lamports.
    pub price_lamports: u64,
    /// PDA bump seed.
    pub bump: u8,
}

impl Listing {
    pub const SPACE: usize = 8 + // discriminator
        32 +     // evo
        32 +     // seller
        8 +      // price_lamports
        1;       // bump
}
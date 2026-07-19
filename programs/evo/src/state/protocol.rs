use anchor_lang::prelude::*;

/// Protocol-level configuration. Created once by the deployer.
/// PDA: ["protocol"] + program_id
#[account]
pub struct ProtocolConfig {
    /// Treasury wallet — receives collection creation fees
    pub treasury: Pubkey,
    /// Authority that can change the treasury address via `update_treasury`.
    /// Should be a cold multisig (e.g. Squads 2-of-3) — separate from the
    /// treasury hot wallet so compromising the treasury doesn't allow
    /// redirecting fees.
    pub treasury_authority: Pubkey,
    /// Fee to create a collection (in lamports)
    pub creation_fee_lamports: u64,
    /// Whether the protocol is initialized
    pub initialized: bool,
    /// Bump seed
    pub bump: u8,
}

impl ProtocolConfig {
    pub const SPACE: usize = 8 + // discriminator
        32 + // treasury
        32 + // treasury_authority
        8 +  // creation_fee_lamports
        1 +  // initialized
        1;   // bump
}
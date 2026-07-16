use anchor_lang::prelude::*;

/// Protocol-level configuration. Created once by the deployer.
/// PDA: ["protocol"] + program_id
#[account]
pub struct ProtocolConfig {
    /// Treasury wallet — receives collection creation fees
    pub treasury: Pubkey,
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
        8 +  // creation_fee_lamports
        1 +  // initialized
        1;   // bump
}
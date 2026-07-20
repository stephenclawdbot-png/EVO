use crate::constants::PROTOCOL_SEED;
use crate::errors::EvoError;
use crate::state::ProtocolConfig;
use anchor_lang::prelude::*;

/// The deployer/upgrade authority allowed to initialize the protocol.
/// This prevents front-running attacks where someone else initializes
/// the protocol and sets their own treasury before the deployer does.
///
/// Set to `Pubkey::default()` to allow anyone to initialize (testing mode).
/// **For mainnet: update this to the real deployer pubkey before deploying.**
pub const REQUIRED_DEPLOYER: Pubkey = Pubkey::new_from_array([
    0xdf, 0x88, 0x59, 0x9f, 0x9b, 0x5d, 0x31, 0x34,
    0x57, 0x8b, 0x8b, 0x84, 0x4a, 0xb2, 0xe9, 0x22,
    0x71, 0xbe, 0xc5, 0x54, 0x81, 0x31, 0x14, 0x47,
    0xaa, 0xf2, 0xe9, 0xeb, 0x76, 0x86, 0x5c, 0xd3,
]); // G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = payer,
        space = ProtocolConfig::SPACE,
        seeds = [PROTOCOL_SEED],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        constraint = REQUIRED_DEPLOYER == Pubkey::default() || payer.key() == REQUIRED_DEPLOYER @ EvoError::NotProtocolDeployer
    )]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_protocol(
    ctx: Context<InitializeProtocol>,
    treasury: Pubkey,
    treasury_authority: Pubkey,
    creation_fee_lamports: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    require!(!config.initialized, EvoError::ProtocolAlreadyInitialized);
    require!(
        treasury_authority != Pubkey::default(),
        EvoError::InvalidTreasuryAuthority
    );

    config.treasury = treasury;
    config.treasury_authority = treasury_authority;
    config.creation_fee_lamports = creation_fee_lamports;
    config.initialized = true;
    config.bump = ctx.bumps.protocol_config;

    msg!(
        "EVO Protocol initialized. Treasury: {}, Treasury authority: {}, Creation fee: {} lamports",
        treasury, treasury_authority, creation_fee_lamports
    );
    Ok(())
}
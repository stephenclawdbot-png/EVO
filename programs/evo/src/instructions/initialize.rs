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
pub const REQUIRED_DEPLOYER: Pubkey = Pubkey::default(); // TODO: set to deployer pubkey for mainnet

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
    creation_fee_lamports: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;

    require!(!config.initialized, EvoError::ProtocolAlreadyInitialized);

    config.treasury = treasury;
    config.creation_fee_lamports = creation_fee_lamports;
    config.initialized = true;
    config.bump = ctx.bumps.protocol_config;

    msg!("EVO Protocol initialized. Treasury: {}, Creation fee: {} lamports", treasury, creation_fee_lamports);
    Ok(())
}
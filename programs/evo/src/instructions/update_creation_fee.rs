use crate::constants::PROTOCOL_SEED;
use crate::errors::EvoError;
use crate::state::ProtocolConfig;
use anchor_lang::prelude::*;

/// Update the protocol creation fee.
///
/// Only the `treasury_authority` (set during `initialize_protocol`) can call this.
/// This allows correcting a misconfigured fee without redeploying or re-initializing.
#[derive(Accounts)]
pub struct UpdateCreationFee<'info> {
    #[account(
        mut,
        seeds = [PROTOCOL_SEED],
        bump = protocol_config.bump,
        has_one = treasury_authority,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// The current treasury authority — must sign and must match the stored authority.
    pub treasury_authority: Signer<'info>,
}

pub fn update_creation_fee(
    ctx: Context<UpdateCreationFee>,
    new_fee_lamports: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    let old_fee = config.creation_fee_lamports;
    config.creation_fee_lamports = new_fee_lamports;

    msg!(
        "Creation fee updated from {} to {} lamports by authority {}",
        old_fee,
        new_fee_lamports,
        ctx.accounts.treasury_authority.key()
    );
    Ok(())
}
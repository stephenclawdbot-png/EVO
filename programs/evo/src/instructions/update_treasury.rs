use crate::constants::PROTOCOL_SEED;
use crate::errors::EvoError;
use crate::state::ProtocolConfig;
use anchor_lang::prelude::*;

/// Update the protocol treasury address.
///
/// Only the `treasury_authority` (set during `initialize_protocol`) can call this.
/// This separates "where fees go" (treasury hot wallet) from "who controls changes"
/// (cold multisig authority), so compromising the treasury wallet doesn't allow
/// redirecting fees — only the authority can do that.
#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(
        mut,
        seeds = [PROTOCOL_SEED],
        bump = protocol_config.bump,
        has_one = treasury_authority,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// The current treasury authority — must sign and must match the stored authority.
    #[account(mut)]
    pub treasury_authority: Signer<'info>,
}

pub fn update_treasury(
    ctx: Context<UpdateTreasury>,
    new_treasury: Pubkey,
) -> Result<()> {
    require!(
        new_treasury != Pubkey::default(),
        EvoError::InvalidTreasuryAuthority
    );

    let config = &mut ctx.accounts.protocol_config;
    let old_treasury = config.treasury;
    config.treasury = new_treasury;

    msg!(
        "Treasury updated from {} to {} by authority {}",
        old_treasury,
        new_treasury,
        ctx.accounts.treasury_authority.key()
    );
    Ok(())
}
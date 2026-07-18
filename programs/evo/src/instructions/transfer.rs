use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer as SystemTransfer, transfer as system_transfer};

#[derive(Accounts)]
#[instruction(evo_id: u32, new_owner: Pubkey)]
pub struct Transfer<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = evo.owner == current_owner.key() @ EvoError::NotEvoOwner,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = !evo.is_listed @ EvoError::EvoIsListedForTransfer,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Protocol treasury — receives the flat transfer fee.
    /// CHECK: Verified by address constraint against protocol_config.treasury
    #[account(mut, address = protocol_config.treasury)]
    pub treasury: SystemAccount<'info>,

    #[account(mut)]
    pub current_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn transfer(ctx: Context<Transfer>, evo_id: u32, new_owner: Pubkey) -> Result<()> {
    let evo = &mut ctx.accounts.evo;

    // Prevent transferring to the zero address — would permanently brick
    // the EVO and lock the embedded SOL (no one owns the default key).
    require!(new_owner != Pubkey::default(), EvoError::InvalidNewOwner);

    // Charge a flat transfer fee routed to the protocol treasury. This closes
    // the royalty-bypass vector (off-platform deals done via free transfer)
    // by making every ownership change non-free, regardless of sale price.
    let fee = TRANSFER_FEE_LAMPORTS;
    let owner_balance = ctx.accounts.current_owner.lamports();
    require!(owner_balance >= fee, EvoError::InsufficientTransferFee);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        SystemTransfer {
            from: ctx.accounts.current_owner.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_transfer(cpi_ctx, fee)?;

    evo.owner = new_owner;
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!(
        "EVO transferred from {} to {} (transfer fee: {} lamports to treasury)",
        ctx.accounts.current_owner.key(),
        new_owner,
        fee
    );
    Ok(())
}
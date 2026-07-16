use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
#[instruction(evo_id: u32)]
pub struct Forge<'info> {
    #[account(
        init,
        payer = owner,
        space = EVOAccount::SPACE,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        mut,
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol_config.bump,
        constraint = protocol_is_initialized(&protocol_config) @ EvoError::ProtocolNotInitialized
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn forge(
    ctx: Context<Forge>,
    evo_id: u32,
    locked_lamports: u64,
    resonance_seed: [u8; 32],
) -> Result<()> {
    let collection = &mut ctx.accounts.collection_config;
    let evo = &mut ctx.accounts.evo;

    require!(protocol_is_initialized(&ctx.accounts.protocol_config), EvoError::ProtocolNotInitialized);
    require!(collection.current_supply < collection.supply_cap, EvoError::SupplyCapReached);
    require!(locked_lamports > 0, EvoError::InsufficientLamports);

    // Initialize the EVO
    evo.collection = collection.key();
    evo.owner = ctx.accounts.owner.key();
    evo.locked_lamports = locked_lamports;
    evo.forged_at = Clock::get()?.unix_timestamp;
    evo.facet_count = 0;
    evo.trade_count = 0;
    evo.resonance_seed = resonance_seed;
    evo.fracture_lines = Vec::new();
    evo.is_listed = false;
    evo.list_price_lamports = 0;
    evo.is_shattered = false;
    evo.bump = ctx.bumps.evo;

    // Increment supply
    collection.current_supply += 1;

    // Transfer SOL from owner to the EVO PDA (locked)
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: evo.to_account_info(),
        },
    );
    transfer(cpi_ctx, locked_lamports)?;

    msg!("EVO #{} forged in collection '{}' with {} lamports locked", evo_id, collection.name, locked_lamports);
    Ok(())
}
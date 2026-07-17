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

    /// CHECK: Creator wallet — receives the mint price. Verified by collection_config.creator
    #[account(mut, address = collection_config.creator)]
    pub creator: SystemAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn forge(
    ctx: Context<Forge>,
    evo_id: u32,
    resonance_seed: [u8; 32],
) -> Result<()> {
    let collection = &mut ctx.accounts.collection_config;
    let evo = &mut ctx.accounts.evo;

    require!(protocol_is_initialized(&ctx.accounts.protocol_config), EvoError::ProtocolNotInitialized);
    require!(collection.current_supply < collection.supply_cap, EvoError::SupplyCapReached);

    let lock_amount = collection.lock_amount_lamports;
    let mint_price = collection.mint_price_lamports;

    // Initialize the EVO
    evo.collection = collection.key();
    evo.owner = ctx.accounts.owner.key();
    evo.locked_lamports = lock_amount;
    evo.forged_at = Clock::get()?.unix_timestamp;
    evo.facet_count = 0;
    evo.trade_count = 0;
    evo.resonance_seed = resonance_seed;
    evo.fracture_lines = Vec::new();
    evo.is_listed = false;
    evo.list_price_lamports = 0;
    evo.is_shattered = false;
    evo.bump = ctx.bumps.evo;

    // Lifecycle state — mint_index is the slot this EVO takes in the collection
    // (assigned BEFORE incrementing supply, so first forge = index 0).
    evo.mint_index = collection.current_supply;
    evo.current_state = 0;
    evo.last_transition_at = evo.forged_at;
    evo.feed_count = 0;
    evo.total_fed_lamports = 0;

    // Increment supply
    collection.current_supply += 1;

    // Transfer mint price from owner to creator (speculative value)
    if mint_price > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
        );
        transfer(cpi_ctx, mint_price)?;
    }

    // Transfer lock amount from owner to the EVO PDA (locked SOL = floor value)
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: evo.to_account_info(),
        },
    );
    transfer(cpi_ctx, lock_amount)?;

    // Defense-in-depth: verify reserve invariant after forge
    verify_reserve_invariant(&evo.to_account_info(), evo.locked_lamports)?;

    msg!("EVO #{} forged in collection '{}'. Mint price: {} lamports to creator, {} lamports locked", evo_id, collection.name, mint_price, lock_amount);
    Ok(())
}
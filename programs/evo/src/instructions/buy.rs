use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
#[instruction(evo_id: u32)]
pub struct Buy<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        mut,
        seeds = [LISTING_SEED, evo.key().as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ EvoError::EvoNotListed,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Current seller — receives the sale price minus royalty
    /// CHECK: Verified by address constraint against evo.owner
    #[account(mut, address = evo.owner)]
    pub seller: UncheckedAccount<'info>,

    /// Collection creator — may receive royalty depending on config
    /// CHECK: Verified by collection_config.creator
    #[account(mut, address = collection_config.creator)]
    pub creator: SystemAccount<'info>,

    /// Protocol treasury — verified against protocol_config.treasury
    /// CHECK: Verified by address constraint
    #[account(mut, address = protocol_config.treasury)]
    pub treasury: Option<SystemAccount<'info>>,

    /// Incinerator — used when royalty destination is Burn.
    /// May be the real Solana incinerator or a custom burn destination
    /// (if collection.burn_destination != Pubkey::default()).
    /// CHECK: Verified at runtime in route_fee against collection.burn_destination
    #[account(mut)]
    pub incinerator: Option<UncheckedAccount<'info>>,

    /// Fallback burn target — always the canonical Solana INCINERATOR. Used
    /// when `incinerator` is program-owned (malicious burn_destination = EVO
    /// PDA). Without this, royalty routing would revert and break all buys.
    /// CHECK: Verified at runtime in route_fee.
    #[account(mut)]
    pub incinerator_fallback: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn buy(ctx: Context<Buy>, evo_id: u32, max_price: u64) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection_config;
    let price = ctx.accounts.listing.price_lamports;

    require!(price > 0, EvoError::InsufficientLamports);

    // Slippage protection — buyer caps the price they will pay. Prevents the
    // seller / MEV from front-running a pending buy with delist+relist at a
    // higher price in the same slot.
    require!(
        price <= max_price,
        EvoError::PriceExceedsMax
    );

    // Prevent self-trade — buyer cannot be the seller
    require!(ctx.accounts.buyer.key() != ctx.accounts.seller.key(), EvoError::SelfTradeNotAllowed);

    // Check buyer has enough
    let buyer_balance = ctx.accounts.buyer.lamports();
    require!(buyer_balance >= price, EvoError::InsufficientPayment);

    // Calculate royalty
    let royalty = calculate_fee(price, collection.trade_royalty_bps);
    let seller_proceeds = price
        .checked_sub(royalty)
        .ok_or(EvoError::MathOverflow)?;

    // Pay the seller
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.seller.to_account_info(),
        },
    );
    transfer(cpi_ctx, seller_proceeds)?;

    // Pay the royalty to the configured destination
    if royalty > 0 {
        route_fee(
            &ctx.accounts.system_program,
            &ctx.accounts.buyer,
            &collection.royalty_destination,
            &ctx.accounts.creator,
            ctx.accounts.treasury.as_ref(),
            ctx.accounts.incinerator.as_ref(),
            &ctx.accounts.incinerator_fallback,
            collection.burn_destination,
            royalty,
        )?;
    }

    // Record the trade — add a fracture line
    let trade_number = evo.trade_count
        .checked_add(1)
        .ok_or(EvoError::MathOverflow)?;
    let clock = Clock::get()?;

    let fracture = FractureLine {
        trade_number,
        previous_owner: evo.owner,
        timestamp: clock.unix_timestamp,
        position: ((evo.resonance_seed[0] as u16 + trade_number as u16 * 37) % 360),
        intensity: ((evo.resonance_seed[1] as u16 + trade_number as u16 * 17) % 100) as u8,
    };

    if evo.fracture_lines.len() < MAX_FRACTURE_LINES {
        evo.fracture_lines.push(fracture);
    }

    evo.owner = ctx.accounts.buyer.key();
    evo.trade_count = trade_number;

    msg!("EVO sold for {} lamports. Royalty: {} lamports. Trade #{}", price, royalty, trade_number);
    Ok(())
}

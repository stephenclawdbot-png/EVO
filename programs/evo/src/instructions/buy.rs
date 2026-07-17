use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        mut,
        constraint = evo.is_listed @ EvoError::EvoNotListed,
        constraint = !evo.is_shattered @ EvoError::EvoShattered,
        constraint = evo.collection == collection_config.key() @ EvoError::CollectionMismatch,
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(seeds = [PROTOCOL_SEED], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Current seller — receives the sale price minus royalty
    /// CHECK: Verified by evo.owner
    #[account(mut, address = evo.owner)]
    pub seller: SystemAccount<'info>,

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

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn buy(ctx: Context<Buy>) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection_config;
    let price = evo.list_price_lamports;

    require!(price > 0, EvoError::InsufficientLamports);

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
            collection.burn_destination,
            royalty,
        )?;
    }

    // Record the trade — add a fracture line
    let trade_number = evo.trade_count + 1;
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
    evo.is_listed = false;
    evo.list_price_lamports = 0;

    msg!("EVO sold for {} lamports. Royalty: {} lamports. Trade #{}", price, royalty, trade_number);
    Ok(())
}

use crate::state::{CollectionConfig, EVOAccount};
use crate::errors::EvoError;
use anchor_lang::prelude::*;

/// Permissionless evolution — anyone can call it, but the EVO only
/// advances if all enabled thresholds for the next stage are met.
#[derive(Accounts)]
pub struct Evolve<'info> {
    #[account(mut)]
    pub evo: Account<'info, EVOAccount>,

    /// Collection config — needed to check thresholds
    pub collection: Account<'info, CollectionConfig>,

    pub system_program: Program<'info, System>,
}

pub fn evolve(ctx: Context<Evolve>) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection;

    // Must belong to this collection
    require!(
        evo.collection == collection.key(),
        EvoError::CollectionMismatch
    );

    // Only Evolution and Custom lifecycle types support evolving
    require!(
        collection.lifecycle_type == crate::state::LifecycleType::Evolution
            || collection.lifecycle_type == crate::state::LifecycleType::Custom,
        EvoError::EvolutionNotEnabled
    );

    // Must be revealed (if collection requires reveal)
    if collection.lifecycle_type == crate::state::LifecycleType::Evolution {
        require!(collection.is_revealed, EvoError::NotRevealed);
    }

    // Can't go past max
    let max_states = collection.max_states;
    require!(max_states > 0, EvoError::EvolutionNotEnabled);
    require!(evo.current_state < max_states, EvoError::AlreadyAtMaxState);

    // The next state is current_state + 1
    let next_state = evo.current_state
        .checked_add(1)
        .ok_or(EvoError::MathOverflow)?;

    // Check all enabled thresholds (AND logic)
    // Thresholds are cumulative: stage N requires threshold * N total
    let now = Clock::get()?.unix_timestamp;

    // Trade threshold
    if collection.evolve_trade_threshold > 0 {
        let required = (collection.evolve_trade_threshold as u64)
            .checked_mul(next_state as u64)
            .ok_or(EvoError::MathOverflow)?;
        require!(
            evo.trade_count as u64 >= required,
            EvoError::EvolutionConditionsNotMet
        );
    }

    // Feed threshold (total lamports fed)
    if collection.evolve_feed_threshold > 0 {
        let required = collection
            .evolve_feed_threshold
            .checked_mul(next_state as u64)
            .ok_or(EvoError::MathOverflow)?;
        require!(
            evo.total_fed_lamports >= required,
            EvoError::EvolutionConditionsNotMet
        );
    }

    // Hold duration threshold
    if collection.evolve_hold_seconds > 0 {
        let held = now
            .checked_sub(evo.last_transition_at)
            .ok_or(EvoError::MathOverflow)?;
        let required = collection
            .evolve_hold_seconds
            .checked_mul(next_state as i64)
            .ok_or(EvoError::MathOverflow)?;
        require!(held >= required, EvoError::EvolutionConditionsNotMet);
    }

    // Locked value threshold
    if collection.evolve_locked_threshold > 0 {
        let required = collection
            .evolve_locked_threshold
            .checked_mul(next_state as u64)
            .ok_or(EvoError::MathOverflow)?;
        require!(
            evo.locked_lamports >= required,
            EvoError::EvolutionConditionsNotMet
        );
    }

    // All checks passed — advance
    evo.current_state = next_state;
    evo.last_transition_at = now;
    evo.facet_count = evo
        .facet_count
        .checked_add(1)
        .ok_or(EvoError::MathOverflow)?;

    Ok(())
}
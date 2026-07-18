use crate::constants::*;
use crate::errors::EvoError;
use crate::state::{CollectionConfig, EVOAccount, LifecycleType};
use anchor_lang::prelude::*;

/// Authority-only stage override for Custom lifecycle collections.
/// Allows the reveal authority to set an EVO's `current_state` to any
/// valid stage (0..=max_states - 1) without meeting evolution thresholds.
///
/// Only works on `Custom` lifecycle collections.
/// `Static`, `Reveal`, `CommitReveal`, and `RevealAndEvolve` collections
/// reject this instruction — their stage transitions are protocol-enforced.
#[derive(Accounts)]
#[instruction(evo_id: u32, stage: u16)]
pub struct SetVisualStage<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump,
    )]
    pub evo: Account<'info, EVOAccount>,

    /// Collection config — must match the EVO's collection
    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    /// The reveal authority — must match `collection.reveal_authority`.
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn set_visual_stage(ctx: Context<SetVisualStage>, evo_id: u32, stage: u16) -> Result<()> {
    let evo = &mut ctx.accounts.evo;
    let collection = &ctx.accounts.collection_config;

    // Must belong to this collection
    require!(
        evo.collection == collection.key(),
        EvoError::CollectionMismatch
    );

    // Only Custom lifecycle supports manual stage override
    require!(
        collection.lifecycle_type == LifecycleType::Custom,
        EvoError::StageTransitionNotAllowed
    );

    // Only the reveal authority can set stages
    require!(
        collection.reveal_authority == ctx.accounts.authority.key(),
        EvoError::NotStageAuthority
    );

    // Stage must be within valid range
    require!(stage < collection.max_states, EvoError::InvalidStage);

    // No backward transitions unless explicitly going to 0 (reset)
    // Forward transitions and resets are allowed in Custom mode.
    evo.current_state = stage;
    evo.last_transition_at = Clock::get()?.unix_timestamp;

    msg!(
        "EVO visual stage set to {} by authority {}",
        stage,
        ctx.accounts.authority.key()
    );
    Ok(())
}
use crate::state::CollectionConfig;
use crate::errors::EvoError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

#[derive(Accounts)]
pub struct RevealCollection<'info> {
    #[account(mut)]
    pub collection: Account<'info, CollectionConfig>,

    /// The reveal authority — must match collection.reveal_authority
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn reveal_collection(ctx: Context<RevealCollection>, secret: [u8; 32]) -> Result<()> {
    let collection = &mut ctx.accounts.collection;

    require!(
        collection.reveal_authority == ctx.accounts.authority.key(),
        EvoError::NotRevealAuthority
    );

    require!(!collection.is_revealed, EvoError::AlreadyRevealed);

    // Static collections cannot be revealed
    require!(
        collection.lifecycle_type != crate::state::LifecycleType::Static,
        EvoError::StageTransitionNotAllowed
    );

    // If a commitment was set (commit_reveal before minting), verify the secret.
    if collection.reveal_commitment != [0u8; 32] {
        let hash = keccak::hashv(&[&secret]).0;
        require!(
            hash == collection.reveal_commitment,
            EvoError::CommitmentHashMismatch
        );
    }

    // Derive the reveal entropy from the secret via keccak256.
    // This prevents the authority from directly choosing the entropy —
    // they must provide a secret that matches the pre-committed hash.
    collection.reveal_entropy = keccak::hashv(&[&secret]).0;
    collection.is_revealed = true;

    Ok(())
}
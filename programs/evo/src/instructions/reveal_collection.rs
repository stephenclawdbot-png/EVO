use crate::constants::*;
use crate::state::CollectionConfig;
use crate::errors::EvoError;
use crate::state::LifecycleType;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

#[derive(Accounts)]
pub struct RevealCollection<'info> {
    #[account(
        mut,
        seeds = [COLLECTION_SEED, collection.name.as_bytes()],
        bump = collection.bump,
    )]
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
        collection.lifecycle_type != LifecycleType::Static,
        EvoError::StageTransitionNotAllowed
    );

    // CommitReveal collections MUST have a commitment set before reveal.
    // This enforces the "provably fair" guarantee — without this check,
    // a creator who never called commit_reveal could freely choose the secret.
    if collection.lifecycle_type == LifecycleType::CommitReveal {
        require!(
            collection.reveal_commitment != [0u8; 32],
            EvoError::CommitmentAfterMintStarted
        );
    }

    // If a commitment was set (commit_reveal before minting), verify the secret.
    if collection.reveal_commitment != [0u8; 32] {
        let hash = keccak::hashv(&[&secret]).0;
        require!(
            hash == collection.reveal_commitment,
            EvoError::CommitmentHashMismatch
        );
    }

    // Derive the reveal entropy from the secret via a domain-separated hash.
    // The commitment is keccak256(secret), but the entropy uses a different
    // domain tag + collection key, so knowing the commitment alone does NOT
    // reveal the entropy. This preserves the "hiding" property of commit-reveal.
    //
    // FAIRNESS SCOPE: this on-chain step only guarantees the *entropy* was not
    // chosen after minting (the creator committed to it up front). It does NOT,
    // by itself, prove the off-chain art permutation actually uses this entropy.
    // The end-to-end "provably fair reveal" claim holds only if the artwork
    // assignment is a published, reproducible function of `reveal_entropy`
    // (e.g. a deterministic shuffle seeded by it) that anyone can recompute and
    // check against `manifest_root` / `artwork_manifest_hash`. Publish that
    // derivation script, or the fairness guarantee stops at this line.
    let collection_key = collection.key();
    collection.reveal_entropy = keccak::hashv(&[&secret, b"entropy", collection_key.as_ref()]).0;
    collection.is_revealed = true;

    Ok(())
}
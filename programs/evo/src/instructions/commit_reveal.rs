use crate::errors::EvoError;
use crate::state::CollectionConfig;
use anchor_lang::prelude::*;

/// Commit to a reveal secret before minting starts.
///
/// The creator calls this with `commitment_hash = keccak256(secret)` before
/// any EVOs are forged. This proves the creator cannot change the secret
/// after seeing who minted which index.
///
/// Later, `reveal_collection(secret)` verifies `keccak256(secret) == commitment_hash`
/// and derives the reveal entropy as `keccak256(secret)`.
#[derive(Accounts)]
pub struct CommitReveal<'info> {
    #[account(
        mut,
        seeds = [crate::constants::COLLECTION_SEED, collection.name.as_bytes()],
        bump = collection.bump,
        constraint = collection.creator == authority.key() @ EvoError::NotCollectionCreator,
    )]
    pub collection: Account<'info, CollectionConfig>,

    /// The collection creator — must be the reveal committer.
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn commit_reveal(ctx: Context<CommitReveal>, commitment_hash: [u8; 32]) -> Result<()> {
    let collection = &mut ctx.accounts.collection;

    // Can only commit once
    require!(
        collection.reveal_commitment == [0u8; 32],
        EvoError::CommitmentAlreadySet
    );

    // Must commit before minting starts
    require!(
        collection.current_supply == 0,
        EvoError::CommitmentAfterMintStarted
    );

    collection.reveal_commitment = commitment_hash;

    msg!(
        "Reveal commitment set for collection '{}'",
        collection.name
    );
    Ok(())
}
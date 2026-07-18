use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

/// Verify a Merkle inclusion proof for an EVO's metadata.
///
/// Anyone can call this — it's a permissionless assertion that the
/// EVO's leaf hash is part of the collection's `manifest_root` Merkle tree.
/// Sets `manifest_verified = true` on the EVO if the proof is valid.
///
/// The leaf hash is typically `keccak256(evo_id || metadata_uri_hash)` or
/// `keccak256(evo_id || state_uris_hash)`, depending on the manifest format.
/// The proof is the sibling hashes from the leaf to the root.
#[derive(Accounts)]
#[instruction(evo_id: u32, _leaf_hash: [u8; 32], _proof: Vec<[u8; 32]>)]
pub struct VerifyMerkleProof<'info> {
    #[account(
        mut,
        seeds = [EVO_SEED, collection_config.key().as_ref(), &evo_id.to_le_bytes()],
        bump = evo.bump
    )]
    pub evo: Account<'info, EVOAccount>,

    #[account(
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump
    )]
    pub collection_config: Account<'info, CollectionConfig>,
}

pub fn verify_merkle_proof(
    ctx: Context<VerifyMerkleProof>,
    evo_id: u32,
    leaf_hash: [u8; 32],
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    let collection = &ctx.accounts.collection_config;
    let evo = &mut ctx.accounts.evo;

    // Collection must have a non-zero manifest root
    require!(
        collection.manifest_root != [0u8; 32],
        EvoError::NoManifestRoot
    );

    // EVO must belong to this collection
    require!(
        evo.collection == collection.key(),
        EvoError::CollectionMismatch
    );

    // EVO must not already be verified
    require!(!evo.manifest_verified, EvoError::AlreadyVerified);

    // Bind the leaf hash to this EVO's on-chain identity.
    // The leaf must be keccak256(evo_id_le || resonance_seed) — this
    // prevents replaying a valid proof from one EVO onto a different EVO.
    let expected_leaf = keccak::hashv(&[&evo_id.to_le_bytes(), &evo.resonance_seed]).0;
    require!(
        leaf_hash == expected_leaf,
        EvoError::MerkleProofInvalid
    );

    // Compute the Merkle root from leaf + proof
    let mut computed = leaf_hash;
    for sibling in &proof {
        // Sort the pair so ordering is deterministic (standard Merkle tree)
        let (left, right) = if computed <= *sibling {
            (computed, *sibling)
        } else {
            (*sibling, computed)
        };
        let mut data = [0u8; 64];
        data[..32].copy_from_slice(&left);
        data[32..].copy_from_slice(&right);
        computed = keccak::hash(&data).0;
    }

    // Verify the computed root matches the stored manifest root
    require!(
        computed == collection.manifest_root,
        EvoError::MerkleProofInvalid
    );

    evo.manifest_verified = true;

    msg!(
        "EVO #{} in collection '{}' verified against manifest root",
        evo_id,
        collection.name
    );
    Ok(())
}
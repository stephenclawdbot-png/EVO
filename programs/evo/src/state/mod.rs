pub mod protocol;
pub mod collection;
pub mod evo;

pub use protocol::*;
pub use collection::*;
pub use evo::*;

use anchor_lang::prelude::*;

/// Where a fee gets routed
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum FeeDestination {
    Treasury,
    Creator,
    Burn,
    Split,
}

/// Lifecycle type — determines how an EVO's visual state progresses.
///
/// Three primary modes (what creators choose):
/// - `Static` — no transitions, art is final from forge
/// - `Reveal` — stage 0 (hidden) → 1 (revealed) via `reveal_collection()`
/// - `RevealAndEvolve` — reveal + ongoing per-asset evolution via `evolve()`
///
/// Two advanced modes:
/// - `CommitReveal` — like Reveal but with pre-committed secret (provably fair)
/// - `Custom` — creator-defined transition rules, `set_visual_stage()` allowed
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleType {
    /// No reveal, no evolution. Art is final from forge.
    Static,
    /// Stage 0 → 1 via `reveal_collection()`. Art visible after reveal.
    Reveal,
    /// Like Reveal, but creator commits hash(secret) before minting.
    /// `reveal_collection(secret)` verifies `keccak256(secret) == commitment`.
    CommitReveal,
    /// Reveal + per-asset evolution. Stage 0 → 1 (reveal), then 1 → 2 → ... → max via `evolve()`.
    RevealAndEvolve,
    /// Creator defines custom transition rules (off-chain, hash-committed).
    /// `set_visual_stage()` allowed for authority override.
    Custom,
}

/// Randomness policy — how mint assignments / trait seeds are determined.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RandomnessPolicy {
    /// No randomness. EVO #N always maps to Artwork #N.
    None,
    /// Creator pre-assigns art deterministically. No shuffle.
    Predetermined,
    /// Manifest committed before mint. One VRF result shuffles all assignments at reveal.
    BatchReveal,
}

/// Lifecycle + randomness parameters passed to create_collection.
/// Keeps the instruction signature manageable.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LifecycleParams {
    pub lifecycle_type: LifecycleType,
    pub max_states: u16,
    pub reveal_authority: Pubkey,
    pub randomness_policy: RandomnessPolicy,
    pub manifest_root: [u8; 32],
    pub evolve_trade_threshold: u32,
    pub evolve_feed_threshold: u64,
    pub evolve_hold_seconds: i64,
    pub evolve_locked_threshold: u64,
    pub transition_policy_hash: [u8; 32],
    pub burn_destination: Pubkey,
    /// SHA-256 hash of the off-chain artwork manifest for integrity verification.
    /// Wallets and marketplaces verify `hash(manifest_json) == artwork_manifest_hash`
    /// before displaying art, ensuring the manifest was not tampered with.
    pub artwork_manifest_hash: [u8; 32],
}

impl Default for LifecycleParams {
    fn default() -> Self {
        Self {
            lifecycle_type: LifecycleType::Static,
            max_states: 0,
            reveal_authority: Pubkey::default(),
            randomness_policy: RandomnessPolicy::None,
            manifest_root: [0u8; 32],
            evolve_trade_threshold: 0,
            evolve_feed_threshold: 0,
            evolve_hold_seconds: 0,
            evolve_locked_threshold: 0,
            transition_policy_hash: [0u8; 32],
            burn_destination: Pubkey::default(),
            artwork_manifest_hash: [0u8; 32],
        }
    }
}

use anchor_lang::prelude::*;

// Seeds
pub const PROTOCOL_SEED: &[u8] = b"protocol";
pub const COLLECTION_SEED: &[u8] = b"collection";
pub const EVO_SEED: &[u8] = b"evo";

// Default protocol values
pub const DEFAULT_CREATION_FEE_LAMPORTS: u64 = 67_890_000; // 0.06789 SOL

// BPS constants (basis points: 100 = 1%, 10000 = 100%)
pub const MAX_SHATTER_FEE_BPS: u16 = 2000; // 20% max
pub const MAX_ROYALTY_BPS: u16 = 2500; // 25% max

// Limits
pub const MAX_COLLECTION_NAME_LEN: usize = 32;
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const MAX_FRACTURE_LINES: usize = 20;
pub const MAX_RESONANCE_SEED_LEN: usize = 32;
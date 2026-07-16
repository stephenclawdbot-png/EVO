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
    /// Send to the protocol treasury
    Treasury,
    /// Send to the collection creator
    Creator,
    /// Burn — permanently destroyed (sent to incinerator)
    Burn,
    /// Split between creator and treasury (50/50)
    Split,
}
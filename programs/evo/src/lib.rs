use anchor_lang::prelude::*;

declare_id!("7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc");

mod constants;
mod errors;
mod state;
mod instructions;
mod utils;

use instructions::*;
use state::*;

#[program]
pub mod evo {
    use super::*;

    /// Initialize the EVO protocol. Called once by the deployer.
    /// Sets the treasury wallet and collection creation fee.
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        treasury: Pubkey,
        creation_fee_lamports: u64,
    ) -> Result<()> {
        instructions::initialize::initialize_protocol(
            ctx,
            treasury,
            creation_fee_lamports,
        )
    }

    /// Create a new collection. Pays the protocol creation fee.
    /// Creator sets shatter fee %, trade royalty %, and their destinations.
    /// These are locked forever — cannot be changed after creation.
    /// metadata_uri points to off-chain JSON with art, description, and item list.
    pub fn create_collection(
        ctx: Context<CreateCollection>,
        name: String,
        supply_cap: u32,
        shatter_fee_bps: u16,
        shatter_fee_destination: FeeDestination,
        trade_royalty_bps: u16,
        royalty_destination: FeeDestination,
        mint_price_lamports: u64,
        lock_amount_lamports: u64,
        metadata_uri: String,
        lifecycle: LifecycleParams,
    ) -> Result<()> {
        instructions::create_collection::create_collection(
            ctx,
            name,
            supply_cap,
            shatter_fee_bps,
            shatter_fee_destination,
            trade_royalty_bps,
            royalty_destination,
            mint_price_lamports,
            lock_amount_lamports,
            metadata_uri,
            lifecycle,
        )
    }

    /// Forge a new EVO in a collection.
    /// Pays mint_price to the creator (buying the shell) and locks SOL inside the EVO (the utility).
    /// The forged EVO belongs to the caller.
    pub fn forge(
        ctx: Context<Forge>,
        evo_id: u32,
        resonance_seed: [u8; 32],
    ) -> Result<()> {
        instructions::forge::forge(ctx, evo_id, resonance_seed)
    }

    /// Feed more SOL into an existing EVO. Increases the floor price.
    /// Only the owner can feed.
    pub fn feed(ctx: Context<Feed>, additional_lamports: u64) -> Result<()> {
        instructions::feed::feed(ctx, additional_lamports)
    }

    /// List an EVO for sale at a specified price.
    /// Only the owner can list.
    pub fn list(ctx: Context<List>, price_lamports: u64) -> Result<()> {
        instructions::list::list(ctx, price_lamports)
    }

    /// Remove a listing. Only the owner can delist.
    pub fn delist(ctx: Context<Delist>) -> Result<()> {
        instructions::delist::delist(ctx)
    }

    /// Buy a listed EVO. Transfers ownership and splits the payment:
    /// - Seller receives: price - royalty
    /// - Royalty destination receives: price * royalty_bps / 10000
    /// The EVO's trade count increments and a fracture line is recorded.
    pub fn buy(ctx: Context<Buy>) -> Result<()> {
        instructions::buy::buy(ctx)
    }

    /// Shatter an EVO to reclaim locked SOL.
    /// Sends locked_lamports - shatter_fee to the owner.
    /// The shatter fee goes to the configured destination.
    /// The EVO is marked as shattered (permanently destroyed).
    pub fn shatter(ctx: Context<Shatter>, evo_id: u32) -> Result<()> {
        instructions::shatter::shatter(ctx, evo_id)
    }

    /// Transfer an EVO to a new owner. No payment involved.
    /// Only the current owner can transfer.
    pub fn transfer(ctx: Context<Transfer>, new_owner: Pubkey) -> Result<()> {
        instructions::transfer::transfer(ctx, new_owner)
    }

    /// Close an empty collection and refund rent to the creator.
    /// Works on both old-format (pre-metadata_uri) and new-format accounts.
    /// Collection must have 0 forged EVOs.
    pub fn close_collection(ctx: Context<CloseCollection>, name: String) -> Result<()> {
        instructions::close_collection::close_collection(ctx, name)
    }

    /// Update the metadata URI for a collection.
    /// Only the collection creator can call this.
    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::update_metadata::update_metadata(ctx, metadata_uri)
    }

    /// Reveal a collection — the reveal authority provides the secret
    /// that was committed before minting (via `commit_reveal`). The program
    /// verifies `keccak256(secret) == reveal_commitment` and derives the
    /// reveal entropy as `keccak256(secret)`. This prevents the authority
    /// from freely choosing entropy after seeing who minted which index.
    pub fn reveal_collection(
        ctx: Context<RevealCollection>,
        secret: [u8; 32],
    ) -> Result<()> {
        instructions::reveal_collection::reveal_collection(ctx, secret)
    }

    /// Commit to a reveal secret before minting starts.
    /// The creator calls this with `commitment_hash = keccak256(secret)`
    /// before any EVOs are forged. Later, `reveal_collection(secret)`
    /// verifies the secret matches this commitment.
    pub fn commit_reveal(
        ctx: Context<CommitReveal>,
        commitment_hash: [u8; 32],
    ) -> Result<()> {
        instructions::commit_reveal::commit_reveal(ctx, commitment_hash)
    }

    /// Permissionless evolution — advances an EVO to its next lifecycle
    /// stage if all enabled thresholds (trades, feeds, hold time, locked value)
    /// for the next stage are met.
    pub fn evolve(ctx: Context<Evolve>) -> Result<()> {
        instructions::evolve::evolve(ctx)
    }

    /// Authority-only stage override for Custom lifecycle collections.
    /// Sets an EVO's `current_state` to any valid stage without threshold checks.
    pub fn set_visual_stage(ctx: Context<SetVisualStage>, stage: u16) -> Result<()> {
        instructions::set_visual_stage::set_visual_stage(ctx, stage)
    }
}
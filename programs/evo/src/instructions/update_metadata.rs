use crate::constants::*;
use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;

/// Update the metadata URI for a collection.
/// Only the collection creator can call this.
#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        mut,
        seeds = [COLLECTION_SEED, collection_config.name.as_bytes()],
        bump = collection_config.bump,
        has_one = creator,
    )]
    pub collection_config: Account<'info, CollectionConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

pub fn update_metadata(ctx: Context<UpdateMetadata>, metadata_uri: String) -> Result<()> {
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        EvoError::MetadataUriTooLong
    );

    let config = &mut ctx.accounts.collection_config;
    config.metadata_uri = metadata_uri;

    msg!(
        "Metadata URI updated for collection '{}'",
        config.name
    );
    Ok(())
}
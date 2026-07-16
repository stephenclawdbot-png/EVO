use crate::constants::*;
use crate::errors::EvoError;
use anchor_lang::prelude::*;

/// Close an empty collection and refund rent to the creator.
/// Uses raw AccountInfo so it works on both old-format (pre-metadata_uri)
/// and new-format accounts without deserialization failures.
#[derive(Accounts)]
#[instruction(name: String)]
pub struct CloseCollection<'info> {
    /// The collection PDA — raw AccountInfo to avoid BorshDeserialize on old format.
    /// PDA is verified by seeds. Creator and supply checked in instruction logic.
    /// CHECK: Verified by seeds derivation + manual creator check.
    #[account(
        mut,
        seeds = [COLLECTION_SEED, name.as_bytes()],
        bump,
    )]
    pub collection_config: AccountInfo<'info>,

    /// The collection creator — must sign and receives the refunded rent.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn close_collection(ctx: Context<CloseCollection>, name: String) -> Result<()> {
    let collection_info = &ctx.accounts.collection_config;
    let data = collection_info.data.borrow();

    // Parse the account data manually (works for both old and new formats).
    // Layout: 8 (discriminator) + 4 (name len) + name + 32 (creator) + 4 (supply_cap) + 4 (current_supply) + ...
    let mut offset = 8;

    // Read name string length
    let name_len = u32::from_le_bytes(
        data[offset..offset + 4].try_into().unwrap()
    ) as usize;
    offset += 4 + name_len;

    // Read creator (32 bytes)
    let creator_bytes = &data[offset..offset + 32];
    let creator_pubkey = Pubkey::new_from_array(creator_bytes.try_into().unwrap());
    offset += 32;

    // Skip supply_cap (4 bytes)
    offset += 4;

    // Read current_supply (4 bytes)
    let current_supply = u32::from_le_bytes(
        data[offset..offset + 4].try_into().unwrap()
    );

    drop(data);

    // Verify the signer is the collection creator
    require!(
        creator_pubkey == ctx.accounts.creator.key(),
        EvoError::NotCollectionCreator
    );

    // Collection must be empty
    require!(current_supply == 0, EvoError::CollectionNotEmpty);

    // Refund all lamports to creator
    let lamports = **collection_info.lamports.borrow();
    **collection_info.lamports.borrow_mut() = 0;
    **ctx.accounts.creator.lamports.borrow_mut() += lamports;

    // Zero out the data so the account is fully gone
    let mut data = collection_info.try_borrow_mut_data()?;
    data.fill(0);

    msg!(
        "Collection '{}' closed. Refunded {} lamports to creator.",
        name,
        lamports
    );
    Ok(())
}
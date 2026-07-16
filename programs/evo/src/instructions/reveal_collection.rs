use crate::state::CollectionConfig;
use crate::errors::EvoError;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RevealCollection<'info> {
    #[account(mut)]
    pub collection: Account<'info, CollectionConfig>,

    /// The reveal authority — must match collection.reveal_authority
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn reveal_collection(ctx: Context<RevealCollection>, reveal_entropy: [u8; 32]) -> Result<()> {
    let collection = &mut ctx.accounts.collection;

    require!(
        collection.reveal_authority == ctx.accounts.authority.key(),
        EvoError::NotRevealAuthority
    );

    require!(!collection.is_revealed, EvoError::AlreadyRevealed);

    collection.reveal_entropy = reveal_entropy;
    collection.is_revealed = true;

    Ok(())
}
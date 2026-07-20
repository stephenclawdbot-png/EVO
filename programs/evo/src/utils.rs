use crate::errors::EvoError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

/// Check if protocol is initialized
pub fn protocol_is_initialized(config: &ProtocolConfig) -> bool {
    config.initialized
}

/// Calculate a fee in lamports from basis points
pub fn calculate_fee(amount: u64, bps: u16) -> u64 {
    (amount as u128 * bps as u128 / 10000) as u64
}

/// Transfer lamports between accounts using direct lamport manipulation.
/// Works on program-owned accounts (unlike System Program transfer CPI).
pub fn transfer_lamports<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    **from.try_borrow_mut_lamports()? = from
        .lamports()
        .checked_sub(amount)
        .ok_or(EvoError::MathOverflow)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(EvoError::MathOverflow)?;
    Ok(())
}

/// Verify the reserve invariant: account balance must back locked_lamports + rent.
pub fn verify_reserve_invariant<'info>(
    evo: &AccountInfo<'info>,
    locked_lamports: u64,
) -> Result<()> {
    let rent = Rent::get()?;
    let rent_minimum = rent.minimum_balance(evo.data_len());
    let required = rent_minimum
        .checked_add(locked_lamports)
        .ok_or(EvoError::MathOverflow)?;
    require!(evo.lamports() >= required, EvoError::ReserveInvariantViolated);
    Ok(())
}

/// Validate that a metadata URI uses an allowed scheme (http, https, ipfs, arweave).
/// Prevents `javascript:` and other dangerous schemes from being stored on-chain.
pub fn validate_metadata_uri(uri: &str) -> Result<()> {
    require!(
        uri.starts_with("http://")
            || uri.starts_with("https://")
            || uri.starts_with("ipfs://")
            || uri.starts_with("arweave://"),
        EvoError::InvalidMetadataUriScheme
    );
    Ok(())
}

/// Route a fee to the configured destination.
/// `from` must be a system-owned account (signer) — System Program transfer is used.
/// `incinerator` is required when destination == Burn.
/// `burn_destination` is the collection's configured burn destination
/// (Pubkey::default() means real incinerator).
pub fn route_fee<'info>(
    system_program: &Program<'info, System>,
    from: &Signer<'info>,
    destination: &FeeDestination,
    creator: &SystemAccount<'info>,
    treasury: Option<&SystemAccount<'info>>,
    incinerator: Option<&UncheckedAccount<'info>>,
    incinerator_fallback: &UncheckedAccount<'info>,
    burn_destination: Pubkey,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    // The fallback must always be the canonical INCINERATOR. It is used when
    // the configured burn destination turns out to be a program-owned PDA
    // (malicious creator set burn_destination to an EVO PDA), so that the fee
    // is burned for real rather than reverting and trapping funds.
    require!(
        incinerator_fallback.key() == crate::constants::INCINERATOR,
        EvoError::InvalidBurnDestination
    );

    match destination {
        FeeDestination::Creator => {
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: creator.to_account_info(),
                },
            );
            transfer(cpi_ctx, amount)?;
        }
        FeeDestination::Treasury => {
            let treasury = treasury.ok_or(EvoError::MissingTreasury)?;
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: treasury.to_account_info(),
                },
            );
            transfer(cpi_ctx, amount)?;
        }
        FeeDestination::Burn => {
            let incinerator = incinerator.ok_or(EvoError::IncineratorRequired)?;
            let burn_dest = if burn_destination == Pubkey::default() {
                crate::constants::INCINERATOR
            } else {
                burn_destination
            };
            require!(
                incinerator.key() == burn_dest,
                EvoError::InvalidBurnDestination
            );
            // If the configured burn destination is owned by this program
            // (e.g. an EVO PDA set maliciously), fall back to the canonical
            // INCINERATOR instead of reverting — never trap the user's funds.
            let burn_target = if incinerator.owner == &crate::ID {
                incinerator_fallback
            } else {
                incinerator
            };
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: burn_target.to_account_info(),
                },
            );
            transfer(cpi_ctx, amount)?;
            msg!("Burned {} lamports to burn destination", amount);
        }
        FeeDestination::Split => {
            let treasury = treasury.ok_or(EvoError::MissingTreasury)?;
            let half = amount / 2;
            let other_half = amount
                .checked_sub(half)
                .ok_or(EvoError::MathOverflow)?;

            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: creator.to_account_info(),
                },
            );
            transfer(cpi_ctx, half)?;

            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: treasury.to_account_info(),
                },
            );
            transfer(cpi_ctx, other_half)?;

            msg!("Split fee: {} to creator, {} to treasury", half, other_half);
        }
    }

    Ok(())
}

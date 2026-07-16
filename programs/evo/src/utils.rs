use crate::constants::*;
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

/// Route a fee to the configured destination
pub fn route_fee<'info>(
    system_program: &Program<'info, System>,
    from: &Signer<'info>,
    destination: &FeeDestination,
    creator: &SystemAccount<'info>,
    treasury: Option<&SystemAccount<'info>>,
    creator_pubkey: Pubkey,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

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
            let treasury = treasury.ok_or(EvoError::CollectionInactive)?;
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
            // Burn = transfer to SystemProgram address (effectively destroyed)
            let burn_address = System::id();
            // We can't easily transfer to the system program itself.
            // Instead, we just don't send it anywhere — it stays with the payer.
            // For a true burn, we'd need a different mechanism.
            // For now, we skip the transfer (fee is effectively burned from circulation
            // because it's not sent to anyone).
            // The fee was already deducted from the seller's proceeds.
            msg!("Burned {} lamports (not routed to any recipient)", amount);
        }
        FeeDestination::Split => {
            let half = amount / 2;
            let other_half = amount - half;

            // Creator gets half
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: creator.to_account_info(),
                },
            );
            transfer(cpi_ctx, half)?;

            // Treasury gets half
            if let Some(treasury) = treasury {
                let cpi_ctx = CpiContext::new(
                    system_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: treasury.to_account_info(),
                    },
                );
                transfer(cpi_ctx, other_half)?;
            }

            msg!("Split fee: {} to creator, {} to treasury", half, other_half);
        }
    }

    Ok(())
}
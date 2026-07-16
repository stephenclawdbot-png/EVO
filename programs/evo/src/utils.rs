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

/// Route a fee to the configured destination.
/// `from` must be a system-owned account (signer) — System Program transfer is used.
/// `incinerator` is required when destination == Burn.
pub fn route_fee<'info>(
    system_program: &Program<'info, System>,
    from: &Signer<'info>,
    destination: &FeeDestination,
    creator: &SystemAccount<'info>,
    treasury: Option<&SystemAccount<'info>>,
    incinerator: Option<&UncheckedAccount<'info>>,
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
            let incinerator = incinerator.ok_or(EvoError::IncineratorRequired)?;
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: incinerator.to_account_info(),
                },
            );
            transfer(cpi_ctx, amount)?;
            msg!("Burned {} lamports to incinerator", amount);
        }
        FeeDestination::Split => {
            let half = amount / 2;
            let other_half = amount - half;

            // Creator always gets their half
            let cpi_ctx = CpiContext::new(
                system_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: creator.to_account_info(),
                },
            );
            transfer(cpi_ctx, half)?;

            // Treasury gets the other half, or creator gets it if no treasury supplied
            if let Some(treasury) = treasury {
                let cpi_ctx = CpiContext::new(
                    system_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: treasury.to_account_info(),
                    },
                );
                transfer(cpi_ctx, other_half)?;
            } else {
                let cpi_ctx = CpiContext::new(
                    system_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: creator.to_account_info(),
                    },
                );
                transfer(cpi_ctx, other_half)?;
            }

            msg!("Split fee: {} to creator, {} to treasury", half, other_half);
        }
    }

    Ok(())
}

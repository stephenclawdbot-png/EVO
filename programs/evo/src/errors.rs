use anchor_lang::error_code;

#[error_code]
pub enum EvoError {
    #[msg("Protocol is already initialized")]
    ProtocolAlreadyInitialized,

    #[msg("Protocol is not initialized")]
    ProtocolNotInitialized,

    #[msg("Collection name is too long")]
    CollectionNameTooLong,

    #[msg("Collection has reached supply cap")]
    SupplyCapReached,

    #[msg("EVO already exists with this ID")]
    EvoAlreadyExists,

    #[msg("EVO does not exist")]
    EvoDoesNotExist,

    #[msg("You are not the owner of this EVO")]
    NotEvoOwner,

    #[msg("EVO is not listed for sale")]
    EvoNotListed,

    #[msg("EVO is already listed")]
    EvoAlreadyListed,

    #[msg("EVO has been shattered")]
    EvoShattered,

    #[msg("Insufficient lamports for the requested operation")]
    InsufficientLamports,

    #[msg("Shatter fee exceeds maximum allowed")]
    ShatterFeeTooHigh,

    #[msg("Trade royalty exceeds maximum allowed")]
    RoyaltyTooHigh,

    #[msg("Insufficient payment for buy")]
    InsufficientPayment,

    #[msg("Excessive fracture lines — EVO is fully shattered")]
    MaxFractureLinesReached,

    #[msg("Collection creation fee not paid")]
    CreationFeeNotPaid,

    #[msg("Collection is paused or inactive")]
    CollectionInactive,
}
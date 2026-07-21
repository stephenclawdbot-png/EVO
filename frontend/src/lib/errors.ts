const MAP: Record<string, string> = {
  SelfTradeNotAllowed: "You can't buy your own listing.",
  PriceExceedsMax: 'Price changed under you — refresh and retry.',
  EvolutionConditionsNotMet: 'Not ready to evolve yet — check feed/hold/locked progress.',
  SupplyCapReached: 'Collection is minted out.',
  EvoShattered: 'This EVO was shattered — it no longer exists.',
  InsufficientTransferFee: 'Transfer costs 0.009 SOL — top up your wallet.',
  NotEvoOwner: "You don't own this EVO.",
  InsufficientPayment: 'Not enough SOL in your wallet.',
  AlreadyAtMaxState: 'Already fully evolved.',
  NotRevealed: 'Collection not revealed yet.',
};

export function humanizeError(raw: string): string {
  for (const [k, v] of Object.entries(MAP)) {
    if (raw.includes(k)) return v;
  }
  if (/0x1$|insufficient lamports/i.test(raw)) return 'Not enough SOL in your wallet.';
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}
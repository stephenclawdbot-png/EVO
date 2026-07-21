export function fmtSol(n: number): string {
  return `${n.toFixed(3)} SOL`;
}

export function fmtSolValue(n: number): string {
  return n.toFixed(3);
}

export function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

export function fmtPctValue(n: number): string {
  return Math.round(n).toString();
}
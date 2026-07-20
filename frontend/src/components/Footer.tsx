export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
        <span>Meld — EVO Protocol — Assets that don&apos;t stay the same.</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="/guide" className="transition-colors hover:text-text">Guide</a>
          <a href="/docs" className="transition-colors hover:text-text">Docs</a>
          <a href="/degens" className="transition-colors hover:text-text">Degen Guide</a>
          <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
          <a href="https://solscan.io/account/Aw4mAC5oUfQCP65a8a6mTwkrL2CoUMsBa45KvWPY3CN2" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Program</a>
          <span>Powered by <a href="https://www.helius.dev/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Helius</a> · <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Supabase</a> · <a href="https://solana.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Solana</a></span>
        </div>
      </div>
    </footer>
  );
}
/** The Cüzdan mark: a wallet with its clasp, drawn from two shapes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M7.5 9 20.6 4.2a2.4 2.4 0 0 1 3.1 1.6L24.7 9" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <rect x="3" y="8.5" width="26" height="19.5" rx="5.5" fill="var(--accent)" />
      <rect x="17.5" y="14.5" width="11.5" height="7.5" rx="3.75" fill="var(--page)" />
      <circle cx="21.6" cy="18.25" r="1.7" fill="var(--accent)" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-7" />
      <span className="text-lg font-extrabold tracking-[-0.03em] text-ink">Cüzdan</span>
    </span>
  )
}

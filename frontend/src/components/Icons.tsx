// Inline Lucide-style SVG icons. 1.5px stroke, 24x24 viewBox.
// No emoji anywhere in the app — these are the visual language.

type IconProps = { className?: string };

const base = (className?: string) => ({
  className: className ?? 'h-5 w-5',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconSun = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const IconMoon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const IconSearch = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

export const IconRefresh = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const IconArrowLeft = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

export const IconArrowRight = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const IconExternalLink = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const IconLock = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const IconPalette = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

export const IconTrendingUp = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7H8.5" />
  </svg>
);

export const IconHammer = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m15 12-8.373 8.373a1 1 0 1 1 3-3L16 9" />
    <path d="m9 15-4-4 6-6 4 4-3 3" />
    <path d="M14 9 9 4" />
    <path d="M17 7 12 2" />
    <path d="m2 22 5-5" />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconX = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const IconAlertTriangle = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const IconChevronRight = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const IconGithub = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const IconLayers = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);

// Meld brand mark — hexagonal badge.
export const IconEvoMark = ({ className }: IconProps) => (
  <svg className={className ?? 'h-8 w-8'} viewBox="0 0 32 32" fill="none">
    <path d="M16 2 28 9v14L16 30 4 23V9L16 2Z" fill="currentColor" opacity="0.12" />
    <path d="M16 2 28 9v14L16 30 4 23V9L16 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M11 10h10l-7 9h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Feed — a droplet / plus into the object.
export const IconFeed = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0L12 2.69Z" />
    <path d="M9 13a3 3 0 0 0 3 3" />
  </svg>
);

// Shatter — a cracked / broken hexagon.
export const IconShatter = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" />
    <path d="M12 2v6l-4 4 4 2-2 5 2 5" />
    <path d="M12 8l4 2" />
  </svg>
);

// Evolve — circular arrows / transform.
export const IconEvolve = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2v4" />
    <path d="m16.24 7.76 2.83-2.83" />
    <path d="M18 12h4" />
    <path d="m16.24 16.24 2.83 2.83" />
    <path d="M12 18v4" />
    <path d="m4.93 19.07 2.83-2.83" />
    <path d="M2 12h4" />
    <path d="m4.93 4.93 2.83 2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Sparkle — intrigue / new.
export const IconSparkle = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3 13.5 9 19 10.5 13.5 12 12 18 10.5 12 5 10.5 12 3Z" />
    <path d="M19 3v4" />
    <path d="M21 5h-4" />
  </svg>
);

// Collection grid icon.
export const IconCollection = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

// Portfolio / wallet icon.
export const IconPortfolio = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M19 7V4a1 1 0 0 0-1-1H3a2 2 0 0 0 0 4h18a1 1 0 0 1 1 1v4M3 7v12a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z" />
    <circle cx="16" cy="14" r="1" fill="currentColor" />
  </svg>
);

// Link / connect.
export const IconLink = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

// Settings / configure.
export const IconSettings = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Upload.
export const IconUpload = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

// User / owner.
export const IconUser = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Coins / SOL.
export const IconCoins = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

// Help / FAQ.
export const IconHelp = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

// Rocket / deploy.
export const IconRocket = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.16 5-1 5-1" />
    <path d="M12 15v5s3.03-.55 4-2c1.16-1.62 1-5 1-5" />
  </svg>
);
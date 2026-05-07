type BrandMarkProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function BrandMark({
  size = 44,
  showWordmark = false,
  className = "",
}: BrandMarkProps) {
  return (
    <div className={["flex items-center gap-3", className].join(" ")}>
      <svg
        aria-label="Gym Circle"
        className="gc-brand-mark shrink-0"
        fill="none"
        height={size}
        role="img"
        viewBox="0 0 100 100"
        width={size}
      >
        <defs>
          <linearGradient id="gc-brand-c" x1="18" x2="82" y1="18" y2="82">
            <stop offset="0%" stopColor="var(--gc-brand-soft)" />
            <stop offset="52%" stopColor="var(--gc-brand)" />
            <stop offset="100%" stopColor="var(--gc-brand-deep)" />
          </linearGradient>
          <filter id="gc-brand-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="50" cy="50" r="42" fill="rgba(6,17,22,0.74)" />
        <path
          d="M70 24A34 34 0 1 0 70 76"
          filter="url(#gc-brand-glow)"
          stroke="url(#gc-brand-c)"
          strokeLinecap="round"
          strokeWidth="11"
        />
        <path
          d="M62 36A20 20 0 1 0 62 64"
          opacity="0.52"
          stroke="url(#gc-brand-c)"
          strokeLinecap="round"
          strokeWidth="7"
        />
        <circle cx="72" cy="70" r="6" fill="var(--gc-brand)" />
      </svg>
      {showWordmark ? (
        <div className="leading-none">
          <p className="text-[18px] font-black uppercase tracking-[0] text-white">
            Gym
          </p>
          <p className="-mt-1 text-[18px] font-black uppercase tracking-[0] text-white">
            Circle
          </p>
        </div>
      ) : null}
    </div>
  );
}

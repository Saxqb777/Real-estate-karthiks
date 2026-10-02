/**
 * The townhouse-on-laterite mark (same drawing as src/app/icon.svg).
 * `lit` = windows glowing marigold (evening); otherwise they reflect the day sky.
 */
export function BrandMark({ size = 34, className, lit = true }: { size?: number; className?: string; lit?: boolean }) {
  const win = lit ? "#FFB547" : "#F3E9D8";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <defs>
        <clipPath id="pe-mark-tile">
          <rect width="64" height="64" rx="10" />
        </clipPath>
        <linearGradient id="pe-mark-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC56A" />
          <stop offset="1" stopColor="#FF9C3F" />
        </linearGradient>
      </defs>
      <g clipPath="url(#pe-mark-tile)">
        <rect width="64" height="64" fill="url(#pe-mark-sky)" />
        <rect y="50" width="64" height="14" fill="#B5532E" />
        <rect y="50" width="64" height="2" fill="#7A3418" />
        <rect x="6" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="30.5" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="55" y="56" width="3" height="3" fill="#F3E9D8" opacity=".8" />
        <rect x="16" y="11" width="10" height="9" rx="2" fill="#15120F" />
        <rect x="11" y="20" width="35" height="4" fill="#15120F" />
        <rect x="13" y="23" width="31" height="27" fill="#15120F" />
        <path d="M44 28h3.5v5h3.5v5h3.5v5h3.5v7H44z" fill="#15120F" />
        <rect x="17.5" y="28" width="7" height="6" fill={win} style={{ transition: "fill .6s" }} />
        <rect x="32.5" y="28" width="7" height="6" fill={win} style={{ transition: "fill .6s" }} />
        <rect x="25.5" y="39" width="6" height="11" fill="#FFB547" />
      </g>
    </svg>
  );
}

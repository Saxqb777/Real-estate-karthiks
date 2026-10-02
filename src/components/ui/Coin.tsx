/** Gold rupee coin glyph (used by coin toasts). */
export function Coin({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#b8650f" />
      <circle cx="16" cy="15" r="14" fill="#ffc35c" />
      <circle cx="16" cy="15" r="11" fill="none" stroke="#c97a14" strokeWidth="1.2" strokeDasharray="1.5 1.6" />
      <path
        d="M11.5 9.5h9M11.5 12.8h9M11.5 9.5h2.6c3.6 0 4.4 6.6 0 6.6h-2.4l6.6 6.4"
        fill="none"
        stroke="#8a4708"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 10a10 10 0 0 1 6-5" stroke="#fff3d6" strokeOpacity=".7" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

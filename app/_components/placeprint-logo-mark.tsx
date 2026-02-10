type PlacePrintLogoMarkProps = {
  className?: string;
};

export function PlacePrintLogoMark({ className }: PlacePrintLogoMarkProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="currentColor" />
      <path
        d="M18 22L30 16L46 21.5V42L30 48L18 42.5V22Z"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M30 16V48" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
      <path
        d="M18 42.5L30 36.5L46 42"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="29.5" r="4" fill="#fff" />
    </svg>
  );
}

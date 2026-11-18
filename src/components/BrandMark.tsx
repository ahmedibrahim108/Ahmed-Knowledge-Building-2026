interface BrandMarkProps {
  className?: string;
}

export default function BrandMark({ className = 'w-8 h-8' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#1E3A5F" />
      {/* Open Book Base */}
      <path
        d="M11 28.5C13.8 27.2 17 27.4 20 29.2C23 27.4 26.2 27.2 29 28.5"
        stroke="#E2E8F0"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central Pillar */}
      <path
        d="M20 9.5V29"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Balance Beam */}
      <path
        d="M10.5 14.5H29.5"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Left Pan */}
      <path
        d="M10.5 14.5L7.5 21C7.5 22.65 8.85 24 10.5 24C12.15 24 13.5 22.65 13.5 21L10.5 14.5Z"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Pan */}
      <path
        d="M29.5 14.5L26.5 21C26.5 22.65 27.85 24 29.5 24C31.15 24 32.5 22.65 32.5 21L29.5 14.5Z"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pivot Accent */}
      <circle cx="20" cy="14.5" r="2.2" fill="#F59E0B" />
    </svg>
  );
}

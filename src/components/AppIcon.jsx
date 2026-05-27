export function AppIcon({ size = 120, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
    >
      <rect width="120" height="120" rx="26" fill="#F4ECD8"/>
      <g transform="rotate(-5, 60, 60)">
        <rect x="19" y="35" width="88" height="56" rx="6" fill="rgba(26,18,8,0.09)"/>
        <rect x="16" y="32" width="88" height="56" rx="6"
              fill="#EDE3C6" stroke="rgba(26,18,8,0.1)" strokeWidth="0.5"/>
        <path d="M44,41 L49,53.1 L61,58 L49,62.9 L44,75 L39,62.9 L27,58 L39,53.1 Z"
              fill="#9C5E4A"/>
        <circle cx="44" cy="58" r="3"   fill="rgba(244,236,216,0.5)"/>
        <circle cx="44" cy="58" r="1.4" fill="#4A1B0C"/>
        <g transform="rotate(18, 78, 52)">
          <path d="M78,40 L81.5,48.5 L90,52 L81.5,55.5 L78,64 L74.5,55.5 L66,52 L74.5,48.5 Z"
                fill="#B8955A"/>
          <circle cx="78" cy="52" r="2.2" fill="rgba(244,236,216,0.45)"/>
          <circle cx="78" cy="52" r="1"   fill="#6B5020"/>
        </g>
      </g>
    </svg>
  );
}

export function BoardIcon({ size = 22, color = "currentColor", className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
    >
      <rect x="10" y="27" width="100" height="66" rx="8"
            fill="none" stroke={color} strokeWidth="7"/>
      <path d="M60,38 L66.1,53.9 L82,60 L66.1,66.1 L60,82 L53.9,66.1 L38,60 L53.9,53.9 Z"
            fill={color}/>
    </svg>
  );
}

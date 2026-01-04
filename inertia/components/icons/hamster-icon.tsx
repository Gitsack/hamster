interface HamsterIconProps {
  className?: string
}

export function HamsterIcon({ className }: HamsterIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
    >
      {/* Hamster face */}
      <ellipse cx="50" cy="55" rx="35" ry="30" fill="currentColor" opacity="0.9" />

      {/* Ears */}
      <ellipse cx="25" cy="30" rx="12" ry="14" fill="currentColor" opacity="0.9" />
      <ellipse cx="25" cy="30" rx="7" ry="9" fill="currentColor" opacity="0.6" />
      <ellipse cx="75" cy="30" rx="12" ry="14" fill="currentColor" opacity="0.9" />
      <ellipse cx="75" cy="30" rx="7" ry="9" fill="currentColor" opacity="0.6" />

      {/* Cheeks */}
      <ellipse cx="28" cy="60" rx="14" ry="12" fill="currentColor" opacity="0.7" />
      <ellipse cx="72" cy="60" rx="14" ry="12" fill="currentColor" opacity="0.7" />

      {/* Eyes */}
      <ellipse cx="38" cy="48" rx="6" ry="7" fill="white" />
      <ellipse cx="62" cy="48" rx="6" ry="7" fill="white" />
      <ellipse cx="39" cy="49" rx="3" ry="4" fill="black" />
      <ellipse cx="63" cy="49" rx="3" ry="4" fill="black" />

      {/* Nose */}
      <ellipse cx="50" cy="58" rx="5" ry="4" fill="white" opacity="0.8" />
    </svg>
  )
}

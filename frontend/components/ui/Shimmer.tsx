interface ShimmerProps {
  className?: string;
}

/** Animated placeholder block for skeleton screens. */
export function Shimmer({ className = "" }: ShimmerProps) {
  return <div className={`zc-shimmer rounded-lg ${className}`} aria-hidden />;
}

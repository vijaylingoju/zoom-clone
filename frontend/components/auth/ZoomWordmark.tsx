interface ZoomWordmarkProps {
  className?: string;
  size?: "xs" | "sm" | "md";
}

const SIZE_CLASS = {
  xs: "text-[13px] tracking-[-0.035em]",
  sm: "text-[20px] tracking-[-0.04em]",
  md: "text-[27px] tracking-[-0.045em]",
} as const;

/** Rounded Zoom-style lowercase wordmark (Kaleko-like via Nunito). */
export function ZoomWordmark({ className = "", size = "md" }: ZoomWordmarkProps) {
  return (
    <span
      className={`font-zoom-wordmark inline-block font-extrabold lowercase leading-none text-[#0e71eb] ${SIZE_CLASS[size]} ${className}`}
      aria-hidden
    >
      zoom
    </span>
  );
}

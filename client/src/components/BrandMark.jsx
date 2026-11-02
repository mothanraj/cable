import { Cable } from "lucide-react";

export default function BrandMark({ size = "md", className = "" }) {
  const isSmall = size === "sm";

  return (
    <span
      className={`brand-mark ${isSmall ? "brand-mark--sm" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <Cable size={isSmall ? 19 : 24} strokeWidth={2.2} />
    </span>
  );
}

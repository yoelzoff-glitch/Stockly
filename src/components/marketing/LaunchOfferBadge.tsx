import React from "react";

interface LaunchOfferBadgeProps {
  text?: string;
  className?: string;
}

export function LaunchOfferBadge({
  text = "10% OFF",
  className = "",
}: LaunchOfferBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[#5B2FE4]/10 text-[#5B2FE4] border border-[#5B2FE4]/20 shadow-2xs ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#5B2FE4]" />
      <span>{text}</span>
    </span>
  );
}

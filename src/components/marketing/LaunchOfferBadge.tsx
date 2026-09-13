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
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[#FAF984] text-[#002B4D] border border-[#002B4D]/15 shadow-2xs ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#003968]" />
      <span>{text}</span>
    </span>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light" | "icon-only";
  size?: "sm" | "md" | "lg";
}

export function Logo({
  className,
  variant = "dark",
  size = "md",
}: LogoProps) {
  const heightClasses = {
    sm: "h-7",
    md: "h-9",
    lg: "h-11",
  };

  const textColor = variant === "light" ? "text-white" : "text-[#101828]";

  if (variant === "icon-only") {
    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)}>
        <svg
          viewBox="0 0 100 100"
          className={cn("w-auto aspect-square", heightClasses[size])}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="100" height="100" rx="26" fill="#5B2FE4" />
          <g strokeLinecap="round" strokeWidth="13.5">
            <line x1="28" y1="28" x2="72" y2="72" stroke="#FFFFFF" />
            <line x1="28" y1="72" x2="72" y2="28" stroke="#F53B98" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none shrink-0", className)}>
      {/* Brand Icon */}
      <svg
        viewBox="0 0 100 100"
        className={cn("w-auto aspect-square", heightClasses[size])}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="26" fill="#5B2FE4" />
        <g strokeLinecap="round" strokeWidth="13.5">
          <line x1="28" y1="28" x2="72" y2="72" stroke="#FFFFFF" />
          <line x1="28" y1="72" x2="72" y2="28" stroke="#F53B98" />
        </g>
      </svg>

      {/* Brand Wordmark */}
      <span
        className={cn(
          "font-serif font-bold tracking-tight leading-none",
          size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl",
          textColor
        )}
        style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}
      >
        Libreta<span className="text-[#F53B98]">X</span>
      </span>
    </div>
  );
}

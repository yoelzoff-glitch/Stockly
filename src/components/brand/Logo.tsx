import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "dark" | "light" | "icon-only" | "wordmark-dark" | "wordmark-light" | "with-icon";
  size?: "sm" | "md" | "lg";
  wordmarkOnly?: boolean;
}

export function Logo({
  className,
  variant = "dark",
  size = "md",
  wordmarkOnly = false,
}: LogoProps) {
  const heightClasses = {
    sm: "h-7",
    md: "h-8",
    lg: "h-10",
  };

  if (variant === "icon-only") {
    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)}>
        <Image
          src="/libretax-icon.png"
          alt="LibretaX"
          width={88}
          height={88}
          className={cn("w-auto aspect-square object-contain select-none", heightClasses[size])}
          priority
        />
      </div>
    );
  }

  const isLight = variant === "light" || variant === "wordmark-light";
  const withIcon = variant === "with-icon";

  const logoSrc = withIcon
    ? isLight
      ? "/libretax-logo-horizontal-light.png"
      : "/libretax-logo-horizontal.png"
    : isLight
      ? "/libretax-wordmark-light.png"
      : "/libretax-wordmark-dark.png";

  return (
    <div className={cn("inline-flex items-center select-none shrink-0", className)}>
      <Image
        src={logoSrc}
        alt="LibretaX"
        width={withIcon ? 340 : 400}
        height={withIcon ? 80 : 86}
        className={cn("w-auto object-contain select-none", heightClasses[size])}
        priority
      />
    </div>
  );
}

import React from "react";
import Image from "next/image";
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

  const logoSrc =
    variant === "light"
      ? "/libretax-logo-horizontal-light.png"
      : "/libretax-logo-horizontal.png";

  return (
    <div className={cn("inline-flex items-center select-none shrink-0", className)}>
      <Image
        src={logoSrc}
        alt="LibretaX"
        width={340}
        height={80}
        className={cn("w-auto object-contain select-none", heightClasses[size])}
        priority
      />
    </div>
  );
}

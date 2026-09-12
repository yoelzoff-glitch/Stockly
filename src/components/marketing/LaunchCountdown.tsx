"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { getPromotionTimeRemaining, CountdownTimeRemaining } from "@/lib/promotions/launchPromotion";

interface LaunchCountdownProps {
  onExpire?: () => void;
  className?: string;
}

export function LaunchCountdown({ onExpire, className = "" }: LaunchCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState<CountdownTimeRemaining>(() =>
    getPromotionTimeRemaining()
  );

  useEffect(() => {
    setMounted(true);
    const initial = getPromotionTimeRemaining();
    setRemaining(initial);

    if (initial.isExpired) {
      onExpire?.();
      return;
    }

    const interval = setInterval(() => {
      const current = getPromotionTimeRemaining();
      setRemaining(current);

      if (current.isExpired) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onExpire]);

  // SSR hydration placeholder to prevent mismatch
  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#DCDAD4] shadow-xs text-xs text-[#5F6875] ${className}`}
        aria-label="La promoción finaliza el 30 de noviembre de 2026"
      >
        <Clock className="w-3.5 h-3.5 text-[#5B2FE4]" />
        <span>Cargando cuenta regresiva...</span>
      </div>
    );
  }

  if (remaining.isExpired) {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div
      className={`inline-flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2 rounded-xl bg-white border border-[#DCDAD4] shadow-xs ${className}`}
      aria-label="La promoción finaliza el 30 de noviembre de 2026"
    >
      <Clock className="w-3.5 h-3.5 text-[#5B2FE4] shrink-0" aria-hidden="true" />

      {/* Desktop format */}
      <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#101828] tabular-nums tracking-tight">
        <span>
          <strong className="font-bold text-[#102A56]">{remaining.days}</strong> días
        </span>
        <span className="text-[#DCDAD4]">·</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.hours)}</strong> hs
        </span>
        <span className="text-[#DCDAD4]">·</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.minutes)}</strong> min
        </span>
        <span className="text-[#DCDAD4]">·</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.seconds)}</strong> seg
        </span>
      </div>

      {/* Mobile format */}
      <div className="flex sm:hidden items-center gap-1.5 text-xs font-semibold text-[#101828] tabular-nums tracking-tight">
        <span>
          <strong className="font-bold text-[#102A56]">{remaining.days}</strong>d
        </span>
        <span className="text-[#94A3B8]">:</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.hours)}</strong>h
        </span>
        <span className="text-[#94A3B8]">:</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.minutes)}</strong>m
        </span>
        <span className="text-[#94A3B8]">:</span>
        <span>
          <strong className="font-bold text-[#102A56]">{pad(remaining.seconds)}</strong>s
        </span>
      </div>
    </div>
  );
}

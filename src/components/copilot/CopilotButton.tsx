"use client";

import React from "react";
import { Sparkles, MessageCircle, X } from "lucide-react";

interface CopilotButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const CopilotButton: React.FC<CopilotButtonProps> = ({
  isOpen,
  onClick,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      {/* Tooltip visible on hover when closed */}
      {!isOpen && (
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out whitespace-nowrap bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
          Preguntale a LibretaX
          <div className="absolute top-1/2 -translate-y-1/2 left-full border-4 border-transparent border-l-slate-900" />
        </div>
      )}

      <button
        onClick={onClick}
        aria-label={isOpen ? "Cerrar LibretaX Copilot" : "Abrir LibretaX Copilot"}
        className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500/30 ${
          isOpen
            ? "bg-slate-800 text-white rotate-90 hover:bg-slate-900 shadow-slate-900/30"
            : "bg-[#0B192C] text-white hover:bg-[#1E3E62] shadow-blue-950/40 hover:scale-105"
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform" />
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-amber-300" />
            {/* Pulsing indicator badge */}
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
            </span>
          </>
        )}
      </button>
    </div>
  );
};

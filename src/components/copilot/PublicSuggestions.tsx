"use client";

import React from "react";
import { HelpCircle, Calculator, Layers, ShoppingBag } from "lucide-react";

interface PublicSuggestionsProps {
  onSelectSuggestion: (question: string) => void;
  disabled?: boolean;
}

const PUBLIC_SUGGESTIONS = [
  {
    icon: HelpCircle,
    label: "¿Qué hace LibretaX?",
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100",
  },
  {
    icon: Calculator,
    label: "¿Cómo calcula la rentabilidad?",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  },
  {
    icon: Layers,
    label: "¿Qué puedo controlar desde LibretaX?",
    color: "text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100",
  },
  {
    icon: ShoppingBag,
    label: "¿Me sirve para mi cuenta de Mercado Libre?",
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
  },
];

export const PublicSuggestions: React.FC<PublicSuggestionsProps> = ({
  onSelectSuggestion,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
        Preguntas frecuentes
      </p>
      <div className="grid grid-cols-1 gap-2">
        {PUBLIC_SUGGESTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              disabled={disabled}
              onClick={() => onSelectSuggestion(item.label)}
              className={`flex items-center gap-3 p-2.5 rounded-xl border text-left text-xs font-medium text-slate-800 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] ${item.color}`}
            >
              <div className="p-1.5 rounded-lg bg-white/80 shadow-xs shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

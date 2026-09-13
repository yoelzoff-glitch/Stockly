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
    color: "text-[#003968] bg-[rgba(0,57,104,0.03)] border-[rgba(0,57,104,0.12)] hover:bg-[rgba(0,223,219,0.08)]",
  },
  {
    icon: Calculator,
    label: "¿Cómo calcula la rentabilidad?",
    color: "text-[#003968] bg-[rgba(0,223,219,0.06)] border-[rgba(0,223,219,0.25)] hover:bg-[rgba(0,223,219,0.12)]",
  },
  {
    icon: Layers,
    label: "¿Qué puedo controlar desde LibretaX?",
    color: "text-[#003968] bg-[rgba(0,57,104,0.03)] border-[rgba(0,57,104,0.12)] hover:bg-[rgba(0,223,219,0.08)]",
  },
  {
    icon: ShoppingBag,
    label: "¿Me sirve para mi cuenta de Mercado Libre?",
    color: "text-[#002B4D] bg-[rgba(250,249,132,0.20)] border-[rgba(250,249,132,0.60)] hover:bg-[rgba(250,249,132,0.35)]",
  },
];

export const PublicSuggestions: React.FC<PublicSuggestionsProps> = ({
  onSelectSuggestion,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <p className="text-xs font-semibold text-[rgba(0,43,77,0.70)] uppercase tracking-wider px-1">
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
              className={`flex items-center gap-3 p-2.5 rounded-xl border text-left text-xs font-medium text-[#002B4D] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] ${item.color}`}
            >
              <div className="p-1.5 rounded-lg bg-white shadow-xs shrink-0 text-[#003968]">
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

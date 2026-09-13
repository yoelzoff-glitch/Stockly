"use client";

import React, { useRef, useEffect } from "react";
import { X, Send, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { CopilotMessage, ChatMessage } from "./CopilotMessage";
import { CopilotSuggestions } from "./CopilotSuggestions";

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (val: string) => void;
  onSendMessage: (msg?: string) => void;
  onResetChat: () => void;
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
  suggestionsComponent?: React.ReactNode;
  placeholderText?: string;
  footerNote?: string;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  isOpen,
  onClose,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onResetChat,
  isLoading,
  title = "LibretaX Copilot",
  subtitle = "Consultá ventas, rentabilidad, stock y performance",
  welcomeTitle = "Hola 👋",
  welcomeMessage = "Soy el copiloto de LibretaX. Puedo ayudarte a entender tus ventas, rentabilidad, productos, stock y performance en tiempo real.",
  suggestionsComponent,
  placeholderText = "Escribe tu pregunta (ej: ¿Cuánto gané hoy?)...",
  footerNote = "Respuestas basadas en datos oficiales de LibretaX",
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages or loading
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="copilot-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[430px] sm:h-[650px] sm:max-h-[calc(100vh-120px)] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0B192C] text-white shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-amber-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 id="copilot-title" className="text-sm font-bold tracking-tight">
              {title}
            </h2>
            <p className="text-[11px] text-slate-300 leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={onResetChat}
              disabled={isLoading}
              title="Nueva conversación"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
        {/* Initial Welcome State */}
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center py-4 space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1">
                <span>{welcomeTitle}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {welcomeMessage}
              </p>
            </div>

            {suggestionsComponent !== undefined ? (
              suggestionsComponent
            ) : (
              <CopilotSuggestions
                disabled={isLoading}
                onSelectSuggestion={(question) => onSendMessage(question)}
              />
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <CopilotMessage key={msg.id} message={msg} />
            ))}
          </>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 my-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#0B192C] text-amber-300 shadow-sm shrink-0">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 shadow-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Consultando información...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={placeholderText}
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0B192C] text-white hover:bg-[#1E3E62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-1 text-[10px] text-center text-slate-400">
          {footerNote}
        </p>
      </div>
    </div>
  );
};

"use client";

import React from "react";
import { Sparkles, User } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isError?: boolean;
}

interface CopilotMessageProps {
  message: ChatMessage;
}

/**
 * Parses markdown-style bold and bullet formatting into clean React elements.
 */
function renderFormattedContent(text: string) {
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    // Bullet point line
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const content = isBullet ? trimmed.slice(2) : line;

    // Parse bold segments
    const parts = content.split(/(\*\*.*?\*\*)/g);
    const renderedLine = parts.map((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={partIdx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={partIdx}>{part}</span>;
    });

    if (isBullet) {
      return (
        <li key={lineIdx} className="ml-4 list-disc text-slate-700 leading-relaxed">
          {renderedLine}
        </li>
      );
    }

    if (trimmed.length === 0) {
      return <div key={lineIdx} className="h-2" />;
    }

    return (
      <p key={lineIdx} className="leading-relaxed text-slate-800">
        {renderedLine}
      </p>
    );
  });
}

export const CopilotMessage: React.FC<CopilotMessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-2.5 my-2 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
          isUser
            ? "bg-slate-200 text-slate-700"
            : "bg-[#0B192C] text-amber-300 shadow-sm"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Message Bubble */}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-xs ${
          isUser
            ? "bg-[#0B192C] text-white rounded-tr-none font-medium"
            : message.isError
            ? "bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-none"
            : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-none"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="space-y-1">{renderFormattedContent(message.content)}</div>
        )}

        <div
          className={`mt-1 text-[10px] text-right ${
            isUser ? "text-slate-300" : "text-slate-400"
          }`}
        >
          {message.timestamp}
        </div>
      </div>
    </div>
  );
};

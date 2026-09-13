"use client";

import React, { useState, useCallback } from "react";
import { CopilotButton } from "./CopilotButton";
import { CopilotPanel } from "./CopilotPanel";
import { ChatMessage } from "./CopilotMessage";

export const LibretaXCopilot: React.FC = () => {
  // Respect feature flag
  const isEnabled = process.env.NEXT_PUBLIC_COPILOT_ENABLED !== "false";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setInputValue("");
  }, []);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputValue).trim();
      if (!text || isLoading) return;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: timeStr,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: text }),
        });

        const data = await response.json();

        const assistantTime = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (!response.ok) {
          const errorMsg =
            data.response ||
            data.error ||
            "No pude consultar tus datos en este momento. Probá de nuevo en unos segundos.";

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-err-${Date.now()}`,
              role: "assistant",
              content: errorMsg,
              timestamp: assistantTime,
              isError: true,
            },
          ]);
          return;
        }

        const replyContent =
          data.response ||
          "Recibí la consulta pero no obtuve un resultado detallado de las herramientas.";

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: replyContent,
            timestamp: assistantTime,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-neterr-${Date.now()}`,
            role: "assistant",
            content:
              "Error de conexión al consultar el asistente. Verificá tu red y probá de nuevo.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading]
  );

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <CopilotButton isOpen={isOpen} onClick={toggleOpen} />
      <CopilotPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSendMessage={handleSendMessage}
        onResetChat={handleResetChat}
        isLoading={isLoading}
      />
    </>
  );
};

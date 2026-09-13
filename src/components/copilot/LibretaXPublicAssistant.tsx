"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CopilotButton } from "./CopilotButton";
import { CopilotPanel } from "./CopilotPanel";
import { ChatMessage } from "./CopilotMessage";
import { PublicSuggestions } from "./PublicSuggestions";

function getOrCreatePublicSessionId(): string {
  if (typeof window === "undefined") return "pub-session-server";
  try {
    let id = sessionStorage.getItem("libretax_public_session_id");
    if (!id) {
      id = "pub-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      sessionStorage.setItem("libretax_public_session_id", id);
    }
    return id;
  } catch {
    return "pub-" + Math.random().toString(36).slice(2, 11);
  }
}

export const LibretaXPublicAssistant: React.FC = () => {
  // Feature flag support
  const isEnabled = process.env.NEXT_PUBLIC_PUBLIC_COPILOT_ENABLED !== "false";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    setSessionId(getOrCreatePublicSessionId());
  }, []);

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
        id: `pub-user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: timeStr,
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setInputValue("");
      setIsLoading(true);

      try {
        const payloadHistory = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/public/copilot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            page: typeof window !== "undefined" ? window.location.pathname : "/",
            history: payloadHistory,
            publicSessionId: sessionId,
          }),
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
            "Alcanzaste temporalmente el límite de consultas. Probá nuevamente más tarde.";

          setMessages((prev) => [
            ...prev,
            {
              id: `pub-err-${Date.now()}`,
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
          "LibretaX centraliza tu información de Mercado Libre para controlar ventas, costos y rentabilidad real.";

        setMessages((prev) => [
          ...prev,
          {
            id: `pub-assistant-${Date.now()}`,
            role: "assistant",
            content: replyContent,
            timestamp: assistantTime,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `pub-neterr-${Date.now()}`,
            role: "assistant",
            content: "Error de conexión al consultar el asistente. Verificá tu red y probá de nuevo.",
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
    [inputValue, isLoading, messages, sessionId]
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
        title="LibretaX Assistant"
        subtitle="Preguntame qué puede hacer LibretaX por tu negocio"
        welcomeTitle="Hola 👋"
        welcomeMessage="Puedo ayudarte a conocer LibretaX, sus herramientas y cómo puede ayudarte a gestionar tu negocio en Mercado Libre."
        suggestionsComponent={
          <PublicSuggestions
            disabled={isLoading}
            onSelectSuggestion={(question) => handleSendMessage(question)}
          />
        }
        placeholderText="Preguntá lo que quieras sobre LibretaX..."
        footerNote="Respuestas oficiales sobre las funciones y planes de LibretaX"
      />
    </>
  );
};

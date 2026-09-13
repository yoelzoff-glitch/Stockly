"use client";

import React, { useState, useCallback } from "react";
import { CopilotButton } from "./CopilotButton";
import { CopilotPanel } from "./CopilotPanel";
import { ChatMessage, ChatMessageAction } from "./CopilotMessage";
import { createClient } from "@/lib/supabase/client";

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
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Fallback: attach validated Supabase bearer token if session exists in browser client
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }
        } catch {
          // SSR cookies remain the primary auth mechanism
        }

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ message: text }),
        });

        // Store correlationId internally for traceability if needed
        const correlationId = response.headers.get("x-correlation-id") || undefined;
        const data = await response.json().catch(() => ({}));

        const assistantTime = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        if (!response.ok) {
          let errorMsg = "No pude consultar tus datos en este momento. Por favor intentá nuevamente más tarde.";
          let action: ChatMessageAction | undefined = undefined;

          if (response.status === 401) {
            errorMsg = "Tu sesión venció. Volvé a iniciar sesión para seguir usando LibretaX Copilot.";
            action = {
              label: "Iniciar sesión",
              href: "/login",
            };
          } else if (response.status === 403) {
            if (data?.code === "ACCOUNT_PAUSED" || (typeof data?.error === "string" && data.error.includes("pausada"))) {
              errorMsg = data.error;
            } else if (data?.code === "SUBSCRIPTION_EXPIRED" || (typeof data?.error === "string" && data.error.includes("suscripción"))) {
              errorMsg = data.error;
            } else {
              errorMsg = "Tu cuenta no tiene acceso a esta función.";
            }
          } else if (response.status === 429) {
            errorMsg = "El servicio de IA está temporalmente ocupado o alcanzaste el límite de consultas. Probá de nuevo en unos segundos.";
          } else {
            errorMsg = "No pude consultar tus datos en este momento. Por favor intentá nuevamente más tarde.";
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-err-${Date.now()}`,
              role: "assistant",
              content: errorMsg,
              timestamp: assistantTime,
              isError: true,
              action,
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

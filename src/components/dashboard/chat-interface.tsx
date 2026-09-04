"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatInterface({ initialMessages, initialPrompt }: { initialMessages: Message[], initialPrompt?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialPrompt && !initializedRef.current) {
      initializedRef.current = true;
      setTimeout(() => {
        submitMessage(initialPrompt);
      }, 500);
    }
  }, [initialPrompt]);

  const QUICK_QUESTIONS = [
    "¿Qué vendí hoy?",
    "¿Qué producto tiene mejor margen?",
    "¿Qué tengo que reponer?",
    "¿Vendí más que ayer?"
  ];

  const handleQuickSubmit = (question: string) => {
    if (isLoading) return;
    setInput(question);

    // Create a synthetic event to pass to handleSubmit
    const syntheticEvent = {
      preventDefault: () => {}
    } as React.FormEvent;

    // We need a timeout to ensure state is updated before submitting
    setTimeout(() => {
      // Actually we can just call the logic directly to avoid race conditions
      submitMessage(question);
    }, 0);
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const handleClear = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar todo el historial de conversación?")) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/chat/clear", { method: "DELETE" });
      if (!res.ok) throw new Error("Error clearing chat");
      setMessages([]);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Error eliminando el historial");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FCFCFA] relative">
      {/* Header / Clear Button */}
      {messages.length > 0 && (
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#DCDAD4] bg-[#FFFFFF] shrink-0">
          <span className="text-xs font-semibold text-[#5F6875] uppercase tracking-wider">
            Sesión de consulta
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isLoading}
            className="h-7 text-xs text-[#5F6875] hover:text-[#D92D20] hover:bg-[#D92D20]/5 px-2"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Limpiar Historial</span>
            <span className="sm:hidden">Limpiar</span>
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 px-4 text-[#5F6875]">
            <div className="w-10 h-10 rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] flex items-center justify-center text-[#102A56] font-mono font-bold text-sm shadow-xs">
              KLY
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-sm font-semibold text-[#101828]">Consultas sobre la operación</h4>
              <p className="text-xs text-[#5F6875]">
                Haz preguntas sobre métricas de venta, reposición de stock, márgenes de ganancia o estado de órdenes.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded bg-[#102A56] text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                KLY
              </div>
            )}
            <div
              className={`max-w-[90%] md:max-w-[75%] px-3.5 py-2.5 rounded-lg ${
                m.role === 'user'
                  ? 'bg-[#102A56] text-white rounded-tr-none text-xs'
                  : 'bg-[#FFFFFF] border border-[#DCDAD4] text-[#101828] rounded-tl-none text-xs shadow-xs'
              }`}
            >
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.role === 'assistant' && m.content.includes("**CONFIRMO**") && (
                <div className="mt-3 flex gap-2 border-t border-[#DCDAD4] pt-2.5">
                  <Button
                    size="sm"
                    onClick={() => submitMessage("Confirmo")}
                    className="h-7 bg-[#198754] hover:bg-[#198754]/90 text-white text-xs font-semibold w-full rounded"
                  >
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => submitMessage("Cancelar")}
                    className="h-7 border-[#DCDAD4] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold w-full rounded"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded bg-[#F5F3EE] border border-[#DCDAD4] text-[#101828] flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-[#5F6875]" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded bg-[#102A56] text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
              KLY
            </div>
            <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-lg rounded-tl-none px-3.5 py-2.5 flex items-center gap-2 text-xs text-[#5F6875]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#102A56]" />
              <span>Consultando datos operativos...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#FFFFFF] border-t border-[#DCDAD4] shrink-0">
        {/* Quick Questions */}
        <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="rounded border border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-medium text-[#101828] hover:bg-[#F5F3EE] transition-colors whitespace-nowrap h-7 px-2.5 shrink-0"
              onClick={() => handleQuickSubmit(q)}
              disabled={isLoading}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="p-4 pt-2.5">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu consulta sobre métricas, ventas o stock..."
              className="flex-1 rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-3 py-2 text-xs placeholder:text-[#5F6875] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#102A56] disabled:cursor-not-allowed disabled:opacity-50 pr-10"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded h-7 w-7 p-0 bg-[#102A56] hover:bg-[#102A56]/90 text-white"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

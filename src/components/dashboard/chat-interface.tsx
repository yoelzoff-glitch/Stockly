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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 relative">
      {/* Header / Clear Button */}
      {messages.length > 0 && (
        <div className="flex justify-end p-2 md:p-3 border-b bg-white dark:bg-slate-950 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={isLoading} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Limpiar Historial</span>
            <span className="sm:hidden">Limpiar</span>
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 px-4">
            <Bot className="w-10 h-10 md:w-12 md:h-12" />
            <p className="text-sm md:text-base">Escribe tu primera pregunta. <br/> Ejemplo: "¿Cuánto vendí hoy?" o "¿Qué productos tienen stock bajo?"</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 md:gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
            )}
            <div 
              className={`max-w-[90%] md:max-w-[80%] px-3 md:px-4 py-2.5 md:py-3 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 border shadow-sm rounded-tl-none'
              }`}
            >
              <p className="text-[13px] md:text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.role === 'assistant' && m.content.includes("**CONFIRMO**") && (
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Button size="sm" onClick={() => submitMessage("Confirmo")} className="bg-green-600 hover:bg-green-700 text-white w-full">
                    Confirmar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => submitMessage("Cancelar")} className="w-full">
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 md:gap-3 justify-start">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-[13px] md:text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-950 border-t shrink-0">
        {/* Quick Questions */}
        <div className="px-3 pt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {QUICK_QUESTIONS.map((q, idx) => (
            <Button 
              key={idx} 
              variant="outline" 
              size="sm" 
              className="rounded-full text-xs whitespace-nowrap border-primary/20 text-primary hover:bg-primary/5 h-8 px-3"
              onClick={() => handleQuickSubmit(q)}
              disabled={isLoading}
            >
              {q}
            </Button>
          ))}
        </div>

        <div className="p-3 md:p-4">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntame sobre tus ventas o stock..."
              className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 md:py-3 text-[13px] md:text-sm ring-offset-background file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-12 shadow-sm"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1 top-1 md:right-1.5 md:top-1.5 rounded-full w-8 h-8 md:w-9 md:h-9"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

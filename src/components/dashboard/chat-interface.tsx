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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      {/* Header / Clear Button */}
      {messages.length > 0 && (
        <div className="flex justify-end p-2 border-b bg-white dark:bg-slate-950">
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={isLoading} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Historial
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
            <Bot className="w-12 h-12" />
            <p>Escribe tu primera pregunta. <br/> Ejemplo: "¿Cuánto vendí hoy?" o "¿Qué productos tienen stock bajo?"</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
            )}
            <div 
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 border shadow-sm rounded-tl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
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
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-950 border-t">
        {/* Quick Questions */}
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_QUESTIONS.map((q, idx) => (
            <Button 
              key={idx} 
              variant="outline" 
              size="sm" 
              className="rounded-full text-xs whitespace-nowrap border-primary/20 text-primary hover:bg-primary/5"
              onClick={() => handleQuickSubmit(q)}
              disabled={isLoading}
            >
              {q}
            </Button>
          ))}
        </div>

        <div className="p-4">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntame sobre tus ventas o stock..."
              className="flex-1 rounded-full border border-input bg-background px-4 py-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-12 shadow-sm"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1.5 top-1.5 rounded-full w-9 h-9"
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "¿Estoy caro?",
  "¿Cuándo me quedo sin stock?",
  "¿Cuánto gano realmente?",
  "¿Conviene pausarlo?",
  "¿Qué harías con este producto?"
];

export function ProductChat({ product, onActionPending }: { product: any, onActionPending: (action: any) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/product-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, message: text })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: data.reply }]);
        if (data.action_pending) {
          onActionPending(data.action_pending);
        }
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Ocurrió un error al contactar al Agente." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-lg bg-card overflow-hidden">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Asistente Contextual</p>
              <p className="text-sm mt-1">Preguntame cualquier cosa sobre el precio, stock, rentabilidad o competencia de este producto.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {SUGGESTED_QUESTIONS.map(q => (
                <Badge 
                  key={q} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-indigo-100 hover:text-indigo-700 transition-colors py-1.5 px-3"
                  onClick={() => handleSend(q)}
                >
                  {q}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
                <div className={`text-sm max-w-[85%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      
      <div className="p-3 border-t bg-muted/30">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntá algo sobre este producto..." 
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

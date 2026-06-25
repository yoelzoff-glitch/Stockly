"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface WorkflowActionsProps {
  workflowId: string;
}

/**
 * Client Component that renders approve/reject buttons for a workflow card.
 * Integrates visual micro-animations (spin loaders) and re-validates the server components via router.refresh().
 */
export function WorkflowActions({ workflowId }: WorkflowActionsProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const router = useRouter();

  const handleAction = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      const res = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, action })
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        console.error("Workflow action failed:", data.error);
        alert(`Error al ejecutar acción: ${data.error || "Desconocido"}`);
      }
    } catch (err) {
      console.error("Workflow action request error:", err);
      alert("Error de red al intentar ejecutar esta acción.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      <Button 
        size="sm" 
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all rounded-full px-4"
        disabled={loading !== null}
        onClick={() => handleAction("approve")}
      >
        {loading === "approve" ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
        )}
        Aprobar Plan
      </Button>
      <Button 
        size="sm" 
        variant="outline" 
        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-950 dark:hover:bg-rose-950/20 font-semibold transition-all rounded-full px-4"
        disabled={loading !== null}
        onClick={() => handleAction("reject")}
      >
        {loading === "reject" ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <XCircle className="w-4 h-4 mr-1.5" />
        )}
        Rechazar
      </Button>
    </div>
  );
}

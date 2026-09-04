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
    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#DCDAD4]">
      <Button
        size="sm"
        className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold px-3"
        disabled={loading !== null}
        onClick={() => handleAction("approve")}
      >
        {loading === "approve" ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        )}
        Aprobar y Ejecutar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-[#D92D20] hover:bg-[#D92D20]/5 text-xs font-semibold px-3"
        disabled={loading !== null}
        onClick={() => handleAction("reject")}
      >
        {loading === "reject" ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
        )}
        Descartar Plan
      </Button>
    </div>
  );
}

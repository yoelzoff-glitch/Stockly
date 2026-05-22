"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAISettings } from "@/actions/ai-settings";
import { Badge } from "@/components/ui/badge";

export function OpenAIConfigModal({ currentModel = "gpt-4o-mini", usage = 0, limit = 500 }: { currentModel?: string, usage?: number, limit?: number }) {
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(currentModel);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateAISettings(model);
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Configurar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuración de OpenAI</DialogTitle>
          <DialogDescription>
            Ajusta los parámetros de tu asistente de Inteligencia Artificial.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-sm font-medium">Consumo Mensual</p>
              <p className="text-xs text-muted-foreground">Consultas utilizadas este mes</p>
            </div>
            <Badge variant="outline">{usage} / {limit}</Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Modelo de IA</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o (Mejor razonamiento)</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o-mini (Más rápido y económico)</SelectItem>
                <SelectItem value="gpt-5-mini">GPT-5-mini (Próximamente)</SelectItem>
                <SelectItem value="auto">Automático (Recomendado)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">El modelo GPT-4o consume más créditos por mensaje.</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Guardando..." : "Guardar cambios"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WhatsAppConfigModal({ waStatus }: { waStatus: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Configurar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configuración de WhatsApp</DialogTitle>
          <DialogDescription>
            Administra la conexión con WhatsApp Cloud API.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Estado:</span>
            <Badge variant={waStatus === 'conectado' ? 'default' : 'secondary'} className="capitalize">{waStatus}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Webhook Status:</span>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo y escuchando</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Última actividad:</span>
            <span className="text-sm text-muted-foreground">Hace 12 minutos</span>
          </div>

          <div className="pt-4 border-t flex flex-col gap-2">
            <Button variant="outline" className="w-full">Enviar mensaje de prueba</Button>
            <Button variant="destructive" className="w-full" disabled>Desconectar número</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

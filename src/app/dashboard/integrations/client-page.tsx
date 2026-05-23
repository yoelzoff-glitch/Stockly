"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAISettings } from "@/actions/ai-settings";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { connectWhatsAppNumberAction, disconnectWhatsAppNumberAction } from "@/actions/whatsapp-connection";

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

export function WhatsAppConfigModal({ waStatus, currentPhoneNumber }: { waStatus: string; currentPhoneNumber?: string }) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(currentPhoneNumber || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("phone_number", phoneNumber);
      const res = await connectWhatsAppNumberAction(null, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.success || "WhatsApp conectado");
        setError(null);
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await disconnectWhatsAppNumberAction();
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.success || "WhatsApp desvinculado");
        setError(null);
        setPhoneNumber("");
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Error al desvincular");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Badge variant={currentPhoneNumber ? 'default' : 'secondary'} className="capitalize">
              {currentPhoneNumber ? 'conectado' : 'pendiente'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Webhook Status:</span>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo y escuchando</Badge>
          </div>

          {currentPhoneNumber ? (
            <div className="space-y-2 border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground">Número vinculado</label>
              <div className="text-lg font-bold tracking-wider bg-secondary/50 p-2.5 rounded-md border text-center">
                +{currentPhoneNumber}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Los mensajes que envíes desde este número al bot serán asignados a tu empresa.
              </p>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-3 border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Número de WhatsApp (Vendedor/Admin)</label>
                <Input 
                  type="text" 
                  placeholder="Ej: +54 9 11 4145-3929 o 541141453929" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa tu número personal/comercial desde el cual escribirás al bot de la plataforma.
                </p>
              </div>
              
              {error && <div className="text-sm text-destructive font-medium">{error}</div>}
              {success && <div className="text-sm text-green-600 font-medium">{success}</div>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Vinculando..." : "Vincular número"}
              </Button>
            </form>
          )}

          {currentPhoneNumber && (
            <div className="pt-4 border-t flex flex-col gap-2">
              {error && <div className="text-sm text-destructive font-medium">{error}</div>}
              {success && <div className="text-sm text-green-600 font-medium">{success}</div>}
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleDisconnect}
                disabled={loading}
              >
                {loading ? "Desconectando..." : "Desconectar número"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

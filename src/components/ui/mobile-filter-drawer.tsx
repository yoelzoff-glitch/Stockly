"use client";

import * as React from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface MobileFilterDrawerProps {
  children: React.ReactNode;
  triggerText?: string;
  onApply?: () => void;
  onClear?: () => void;
}

export function MobileFilterDrawer({ 
  children, 
  triggerText = "Filtros",
  onApply,
  onClear
}: MobileFilterDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full sm:hidden flex items-center justify-center gap-2">
          <Filter className="w-4 h-4" />
          {triggerText}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-4 flex flex-col pt-6 pb-0 sm:hidden">
        <SheetHeader className="pb-4 border-b shrink-0 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">Filtros</SheetTitle>
            {/* The default close button is rendered by SheetContent, but we can customize if needed */}
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {children}
        </div>

        <div className="border-t py-4 pb-8 shrink-0 flex gap-3 bg-background">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={() => {
              if (onClear) onClear();
              setOpen(false);
            }}
          >
            Limpiar
          </Button>
          <Button 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700" 
            onClick={() => {
              if (onApply) onApply();
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

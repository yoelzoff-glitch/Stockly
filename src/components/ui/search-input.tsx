"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";

export function SearchInput({ placeholder = "Buscar..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const currentQ = searchParams.get("q") || "";
    if (term === currentQ) return; // Avoid infinite loop

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set("q", term);
      } else {
        params.delete("q");
      }
      // Always reset page to 1 when searching
      params.delete("page");
      
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300); // debounce 300ms

    return () => clearTimeout(handler);
  }, [term, pathname, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="pl-9 w-full sm:w-64 bg-muted/50"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {isPending && (
        <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      )}
    </div>
  );
}

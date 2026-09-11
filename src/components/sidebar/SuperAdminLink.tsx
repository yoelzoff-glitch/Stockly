"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { checkIsPlatformAdminAction } from "@/app/super-admin/actions";

export function SuperAdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    checkIsPlatformAdminAction()
      .then((res) => {
        if (mounted) setIsAdmin(res);
      })
      .catch(() => {
        if (mounted) setIsAdmin(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="pt-2 border-t border-[#DCDAD4] px-1">
      <Link
        href="/super-admin"
        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold bg-[#0B132B] text-white hover:bg-[#1C2541] transition-all shadow-sm"
      >
        <ShieldAlert className="w-4 h-4 text-[#3A86FF] shrink-0" />
        <div className="flex-1 truncate">
          <span className="block text-[11px] leading-none">Super Admin</span>
          <span className="text-[9px] text-[#94A3B8] font-normal leading-tight">
            Plataforma SaaS
          </span>
        </div>
      </Link>
    </div>
  );
}

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/security/platformAdminAuth";
import { SuperAdminSidebar } from "./SuperAdminSidebar";

export const metadata = {
  title: "Super Admin | LibretaX SaaS",
  description: "Módulo administrativo interno de LibretaX",
};

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let adminContext;
  try {
    adminContext = await requirePlatformAdmin();
  } catch (error: any) {
    if (error?.code === "AUTH_REQUIRED") {
      redirect("/login");
    }
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#0F172A] overflow-hidden">
      <SuperAdminSidebar
        adminEmail={adminContext.email}
        adminRole={adminContext.role}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}

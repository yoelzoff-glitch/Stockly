import type { Metadata } from "next";
import { LibretaXPublicAssistant } from "@/components/copilot/LibretaXPublicAssistant";

export const metadata: Metadata = {
  title: "Propuesta Comercial | LibretaX",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PropuestaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <LibretaXPublicAssistant />
    </>
  );
}

import type { Metadata } from "next";

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
  return <>{children}</>;
}

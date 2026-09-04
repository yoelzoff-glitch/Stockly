import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${archivo.variable} ${archivo.className} min-h-screen bg-[#F5F3EE] text-[#101828] antialiased selection:bg-[#F2C94C] selection:text-[#101828]`}>
      {children}
    </div>
  );
}

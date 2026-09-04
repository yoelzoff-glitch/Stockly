export function Footer() {
  return (
    <footer className="mt-8 px-4 md:px-8 pb-8 pt-4 border-t border-[#DCDAD4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5F6875]">
      <p>
        &copy; {new Date().getFullYear()} Klyvo. Plataforma operativa para vendedores de Mercado Libre.
      </p>
      <div className="flex items-center gap-4 text-[11px]">
        <span>Conexión oficial OAuth 2.0</span>
        <span>•</span>
        <span>Aislamiento de datos con RLS</span>
      </div>
    </footer>
  );
}

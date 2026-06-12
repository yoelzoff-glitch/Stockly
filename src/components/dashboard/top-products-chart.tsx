"use client";

export function TopProductsChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No hay suficientes datos de ventas.
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3 pt-2">
      {data.slice(0, 5).map((item, index) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 truncate max-w-[250px] md:max-w-[300px]" title={item.name}>
                {index + 1}. {item.name}
              </span>
              <span className="text-slate-600 font-semibold shrink-0 text-xs">
                {item.value} {item.value === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

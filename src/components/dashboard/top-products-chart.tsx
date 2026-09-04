"use client";

export function TopProductsChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[#5F6875] text-center p-4">
        Todavía no hay ventas en este período para clasificar productos.
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3.5 pt-1">
      {data.slice(0, 5).map((item, index) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#101828] truncate max-w-[220px] md:max-w-[280px]" title={item.name}>
                {index + 1}. {item.name}
              </span>
              <span className="text-[#5F6875] font-bold shrink-0 tabular-nums">
                {item.value} {item.value === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>
            <div className="h-2 w-full bg-[#F5F3EE] rounded-full overflow-hidden border border-[#DCDAD4]/60">
              <div
                className="h-full bg-[#102A56] rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

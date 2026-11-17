import { z } from "zod";

const entry = z.object({ type: z.string(), amount: z.number().finite().nonnegative().max(999999999999.99) });
const summarySchema = z.object({
  period: z.object({ key: z.string(), date_from: z.string(), date_to: z.string() }),
  bill_includes: z.object({ charges: z.array(entry), bonuses: z.array(entry) }),
  errors: z.array(z.unknown()).max(0),
});
export interface MeliVatEstimate {
  commissionVat: number; shippingVat: number;
  periodFrom: string; periodTo: string; fetchedAt: string;
}

/** Only known sale/shipping codes; never includes tax perceptions or other charges. */
export function parseMeliVatSummary(raw: unknown, month: string, fetchedAt: string): MeliVatEstimate {
  const data = summarySchema.parse(raw);
  if (data.period.key !== `${month}-01`) throw new Error("Unexpected billing period");
  const sum = (rows: z.infer<typeof entry>[], code: string) => rows
    .filter(row => row.type === code).reduce((total, row) => total + Math.round(row.amount * 100), 0);
  const vat = (charge: string, bonus: string) => Math.round((sum(data.bill_includes.charges, charge)
    - sum(data.bill_includes.bonuses, bonus)) * 21 / 121) / 100;
  return { commissionVat: vat("CV", "BV"), shippingVat: vat("CXD", "BXD"),
    periodFrom: data.period.date_from, periodTo: data.period.date_to, fetchedAt };
}

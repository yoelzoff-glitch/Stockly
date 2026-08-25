// src/app/dashboard/ads/page.tsx
import { getAdsDataAction } from "./actions";
import { AdsClientPage } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mercado Libre ADS & Rendimiento Limpio - Klyvo",
  description: "Monitorea tus campañas de Mercado Libre Product ADS, presupuesto diario, facturación y la ganancia limpia real descontando costo de joya y publicidad."
};

export default async function AdsDashboardPage() {
  let adsData = {
    campaigns: [] as any[],
    productAdsList: [] as any[],
    totalAdsInvestment: 0,
    totalAdsRevenue: 0,
    totalCleanNetProfit: 0,
    averageAcos: 0,
    overallRoas: 0,
    liveAdsAvailable: false
  };

  try {
    adsData = await getAdsDataAction();
  } catch (err) {
    console.error("Failed to load ADS data:", err);
  }

  return (
    <AdsClientPage initialAdsData={adsData} />
  );
}

// src/app/dashboard/ads/page.tsx
import { getAdsDataAction } from "./actions";
import { AdsClientPage } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mercado Libre ADS & Rendimiento Limpio - LibretaX",
  description: "Auditoría en tiempo real de tu publicidad en Mercado Libre, ACOS real y rendimiento."
};

export default async function AdsDashboardPage() {
  let adsData: {
    campaigns: any[];
    productAdsList: any[];
    totalAdsInvestment: number | null;
    totalAdsRevenue: number | null;
    totalCleanNetProfit: number | null;
    averageAcos: number | null;
    overallRoas: number | null;
    liveAdsAvailable: boolean;
  } = {
    campaigns: [],
    productAdsList: [],
    totalAdsInvestment: null,
    totalAdsRevenue: null,
    totalCleanNetProfit: null,
    averageAcos: null,
    overallRoas: null,
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

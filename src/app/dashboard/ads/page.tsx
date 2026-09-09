// src/app/dashboard/ads/page.tsx
import { getAdsDataAction } from "./actions";
import { AdsClientPage } from "./client-page";
import { AdsDataResult } from "@/services/meli/ads/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mercado Libre ADS & Rendimiento Limpio - LibretaX",
  description: "Auditoría en tiempo real de tu publicidad en Mercado Libre, ACOS real y rendimiento.",
};

export default async function AdsDashboardPage() {
  let adsData: AdsDataResult = {
    period: "30days",
    periodLabel: "Últimos 30 días",
    availability: {
      available: false,
      reason: "network_error",
      message: "Cargando métricas de Product Ads...",
    },
    advertiser: {
      advertiserId: null,
      siteId: null,
    },
    campaigns: [],
    adGroups: [],
    productAdsList: [],
    totals: {
      investment: null,
      revenue: null,
      cleanNetProfit: null,
      averageAcos: null,
      overallRoas: null,
    },
    totalAdsInvestment: null,
    totalAdsRevenue: null,
    totalCleanNetProfit: null,
    averageAcos: null,
    overallRoas: null,
    liveAdsAvailable: false,
  };

  try {
    adsData = await getAdsDataAction();
  } catch (err) {
    console.error("Failed to load ADS data:", err);
  }

  return <AdsClientPage initialAdsData={adsData} />;
}

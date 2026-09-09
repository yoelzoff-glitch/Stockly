# Integración Mercado Libre Product Ads API v2 + Ad Groups

## Visión General

La integración de **Mercado Libre Product Ads** en LibretaX proporciona visibilidad comercial en tiempo real sobre la pauta publicitaria oficial de cada seller, calculando la rentabilidad neta real por publicación al cruzar los costos publicitarios oficiales con los costos de mercadería vendida (CMV), comisiones de Mercado Libre, costos de envío, impuestos y costos de empaque.

```text
Mercado Libre Product Ads (Oficial)
        ↓
Advertiser & Site ID (API v1)
        ↓
Campaigns (API v2)
        ↓
Ad Groups (API v2)
        ↓
Métricas Reales Oficiales
        ↓
Cruce con costos LibretaX (calculateRealProfitability)
        ↓
Rentabilidad neta real y ACOS / ROAS exacto
```

---

## 1. Requisitos de Acceso & Permisos Funcionales

Para que LibretaX pueda consultar las métricas de Product Ads, la aplicación debe tener autorizado el permiso funcional de **Publicidad** en Mercado Libre Developers:

```text
Mercado Libre Developers
→ Mis aplicaciones
→ LibretaX
→ Permisos funcionales
→ Publicidad
```

### Modo de Operación
LibretaX opera en **modo solo lectura** para Product Ads:
- Consulta de anunciantes (`advertiser`).
- Consulta de campañas publicitarias (`campaigns`).
- Consulta de grupos de anuncios (`ad_groups`).
- Extracción de métricas oficiales (`metrics`).

*No se ejecutan modificaciones de presupuesto, pausas ni creación de campañas desde LibretaX.*

---

## 2. Flujo de Comunicación y Endpoints

### 2.1 Obtención del Anunciante (`Advertiser`)

- **Método**: `GET`
- **Endpoint**: `/advertising/advertisers?product_id=PADS`
- **Header Requerido**: `api-version: 1`
- **Respuesta Esperada**:
  ```json
  {
    "advertisers": [
      {
        "advertiser_id": 12345678,
        "site_id": "MLA"
      }
    ]
  }
  ```
- **Contrato**: Devuelve `{ advertiserId: number, siteId: string }`.
- **Regla Estricta**: Nunca se realiza fallback de `meli_user_id → advertiser_id`. Si el endpoint no retorna un `advertiser_id`, se devuelve un estado de disponibilidad estructurado (`product_ads_not_enabled`).

### 2.2 Campañas Publicitarias (`Campaigns API v2`)

- **Método**: `GET`
- **Endpoint**: `/advertising/{SITE_ID}/advertisers/{ADVERTISER_ID}/product_ads/campaigns/search`
- **Header Requerido**: `api-version: 2`
- **Parámetros**:
  - `limit`: tamaño de página (default 50)
  - `offset`: paginación
  - `date_from`: `YYYY-MM-DD`
  - `date_to`: `YYYY-MM-DD`

### 2.3 Grupos de Anuncios (`Ad Groups API v2`)

- **Método**: `GET`
- **Endpoint**: `/advertising/{SITE_ID}/advertisers/{ADVERTISER_ID}/product_ads/ad_groups/search`
- **Header Requerido**: `api-version: 2`
- **Parámetros**:
  - `limit`: tamaño de página (default 50)
  - `offset`: paginación
  - `campaign_id` / `campaign_ids`
  - `date_from`: `YYYY-MM-DD`
  - `date_to`: `YYYY-MM-DD`

---

## 3. Endpoints Legacy Eliminados

Los siguientes endpoints y patrones obsoletos fueron completamente desestimados:
1. `GET /advertising/product_ads/campaigns/search?advertiser_id={id}`
2. `GET /advertising/advertisers/{id}/product_ads/campaigns` (v1 sin site_id)
3. `GET /advertising/product_ads/advertisers/{id}/campaigns`
4. `GET /advertising/product_ads/campaigns/search?user_id={meli_user_id}`
5. `GET /advertising/advertisers/{id}/product_ads/ads` (legacy ads sin Ad Groups)
6. Fallback de estimación de inversión: `Math.round(revenue * 0.1127)`.

---

## 4. Modelo de Métricas Reales

LibretaX modela las métricas publicitarias como valores numéricos o `null` (cuando no están disponibles en la respuesta de la API), distinguiendo siempre entre `0` (gasto real cero) y datos no provistos:

```typescript
export interface AdsMetrics {
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  cpc: number | null;
  ctr: number | null;
  directAmount: number | null;
  indirectAmount: number | null;
  totalAmount: number | null;
  acos: number | null;
  tacos: number | null;
  roas: number | null;
  cvr: number | null;
  unitsQuantity: number | null;
}
```

---

## 5. Manejo y Clasificación de Errores

| Código HTTP | Clasificación LibretaX | Causa | Mensaje / Acción UI |
| :--- | :--- | :--- | :--- |
| **401** | `auth_error` | Token expirado o revocado | "Sesión expirada. Reconectá la cuenta de Mercado Libre." |
| **403** | `advertising_permission_missing` | Falta permiso functional Publicidad en Dev Center | "Mercado Libre no autorizó acceso a Publicidad para esta aplicación." con botón a configuración |
| **404** | `product_ads_not_enabled` | Seller sin Product Ads habilitado | "Esta cuenta de Mercado Libre todavía no tiene Product Ads habilitado." |
| **429** | `rate_limit_exceeded` | Límite de tasa de Mercado Libre | Reintentos con backoff exponencial automático y lectura de header `Retry-After` en `meliFetch` |
| **5xx / Timeout**| `network_error` | Caída temporal de servicios de Ads | "No pudimos obtener las métricas publicitarias en este momento." con botón Reintentar |

---

## 6. Cruce de Rentabilidad Real (`calculateRealProfitability`)

Por cada publicación anunciada, LibretaX extrae el `item_id` y lo vincula con los productos locales registrados por `meli_item_id -> SKU -> sin match` (nunca por coincidencia difusa de título).

```text
  Facturación Atribuida (Total Amount)
- Inversión Publicitaria Real (Cost)
- Costo de Mercadería Vendida (CMV / Costo Unitario × Unidades)
- Comisión de Mercado Libre (Estimated Fee)
- Costo de Envío (Estimated Shipping)
- Extra Fees
- Descuentos y Promociones
- Impuestos (Estimated Tax)
- Costo de Empaque (Packaging Cost)
---------------------------------------------------------
= GANANCIA NETA REAL LIMPIA
```

---

## 7. Aislamiento Multi-Tenant & Demo

- **Multi-Tenant**: Cada consulta utiliza estrictamente el `tenant_id` autenticado para resolver credenciales y tokens OAuth individuales.
- **Cuenta Demo**: Las llamadas para el tenant de demostración son interceptadas de forma segura y devuelven un conjunto de datos sintético realista sin interactuar con las APIs externas de Mercado Libre.
- **Caché en Memoria**: Caché corto de 60 segundos por `tenantId:period` para optimizar tiempos de respuesta y proteger cuotas de rate limit.

import {
  CANONICAL_PLANS,
  LAUNCH_PROMOTION,
  calculatePromotionalPrice,
  isPromotionActive,
} from "@/lib/promotions/launchPromotion";

/**
 * Fuente canónica y estructurada de conocimiento público sobre LibretaX.
 * Integra configuración oficial de planes, precios y promociones dinámicamente
 * para evitar discrepancias entre la landing comercial y las respuestas de la IA.
 */
export function getPublicKnowledge(): string {
  const isPromo = isPromotionActive();

  const plansSummary = CANONICAL_PLANS.map((plan) => {
    const priceInfo = calculatePromotionalPrice(
      plan.baseAmount,
      "USD",
      isPromo ? LAUNCH_PROMOTION.discountPercentage : 0
    );

    const priceString = isPromo
      ? `${priceInfo.promoPriceFormatted} (precio promocional con ${LAUNCH_PROMOTION.discountPercentage}% OFF, precio regular ${priceInfo.normalPriceFormatted})`
      : `${priceInfo.normalPriceFormatted}`;

    return `### Plan ${plan.name}:
- **Límite:** ${plan.skuLimit}
- **Precio:** ${priceString} ${plan.billingPeriod}
- **Descripción:** ${plan.description}
- **Características incluidas:**
${plan.features.map((f) => `  - ${f}`).join("\n")}
`;
  }).join("\n");

  return `
# BASE DE CONOCIMIENTO OFICIAL DE LIBRETAX

## 1. ¿QUÉ ES LIBRETAX?
LibretaX es una plataforma integral de gestión financiera, analítica operativa y automatización diseñada exclusivamente para vendedores profesionales que operan en Mercado Libre.
Su objetivo principal es responder con total exactitud la pregunta clave del vendedor: "¿Cuánto dinero estoy ganando realmente en mi negocio?".
Centraliza ventas, costos de mercadería, comisiones de Mercado Libre, costos de envío, gastos de embalaje, cupones, promociones y campañas de Mercado Ads en un único lugar.

## 2. ¿PARA QUIÉN ESTÁ PENSADO?
Está pensado para pequeños, medianos y grandes vendedores de Mercado Libre (fabricantes, distribuidores, importadores y comerciantes minoristas) que necesitan:
- Dejar de gestionar su rentabilidad en hojas de cálculo desactualizadas o propensas a errores.
- Conocer su margen neto real después de todas las comisiones, retenciones y costos logísticos.
- Controlar stock físico en depósito y sincronizar publicaciones compuestas (combos).
- Automatizar decisiones de catálogo y precios con inteligencia artificial segura.

## 3. INTEGRACIÓN CON MERCADO LIBRE
- Se conecta de forma directa y oficial mediante la API de Mercado Libre (OAuth 2.0).
- Sincroniza en tiempo real: órdenes, publicaciones, estados de envíos, cobros y campañas publicitarias.
- Admite catálogos con cientos o miles de publicaciones y múltiples variantes.

## 4. RENTABILIDAD REAL Y FÓRMULA FINANCIERA
A diferencia de Mercado Libre, que únicamente muestra facturación bruta, LibretaX calcula la Ganancia Neta Real aplicando la fórmula exacta:
Ganancia Neta = Facturación Bruta - (Costo de Producto + Comisión ML + Costo de Envío + Promociones y Cupones + Packaging y Costos Operativos)
Margen Neto (%) = (Ganancia Neta / Facturación Bruta) * 100

Aspectos clave del motor financiero:
- **Snapshots Históricos de Costo:** Al congelarse una orden, se almacena el costo unitario de ese momento exacto. Si el vendedor sube el costo de reposición de sus productos meses después, las órdenes pasadas no se alteran, preservando la inmutabilidad contable.
- **Cobertura de Costos:** Si un vendedor vende productos a los que aún no les cargó el costo de compra, LibretaX le advierte claramente el porcentaje de cobertura (ej: "Cobertura del 85%"), para que sepa si la ganancia calculada puede estar sobreestimada.

## 5. COMISIONES, ENVÍOS Y EMBALAJE
- **Comisiones ML:** Calcula automáticamente el porcentaje y monto fijo según la categoría del producto y tipo de publicación (Clásica o Premium).
- **Envíos (Mercado Envíos):** Computa el costo exacto a cargo del vendedor según dimensiones, peso y beneficios por reputación.
- **Costos de Embalaje:** Permite definir un costo promedio de packaging por paquete o por producto para deducirlo automáticamente.

## 6. MERCADO ADS (PUBLICIDAD)
- Módulo integrado para auditar campañas de Mercado Ads.
- Métricas clave: Inversión en publicidad, ingresos atribuidos, ACOS (Advertising Cost of Sales) y ROAS (Return on Ad Spend).
- Deducido directamente en el balance de rentabilidad neta global.

## 7. CONTROL DE STOCK DUAL Y COMBOS
LibretaX resuelve una de las mayores dificultades del vendedor de Mercado Libre mediante su arquitectura de stock dual:
- **Stock Interno:** Inventario físico real disponible en tu depósito o local.
- **Stock Publicado:** Unidades publicadas en Mercado Libre.
- **Combos y Fórmulas (BOM):** Permite armar publicaciones compuestas por múltiples componentes físicos. Al venderse un combo, LibretaX descuenta las partes individuales del inventario físico.
- **Discrepancias de Stock:** Alerta si hay publicaciones en Mercado Libre con más stock publicado que el disponible físicamente en depósito.

## 8. INTELIGENCIA ARTIFICIAL EN LIBRETAX
LibretaX cuenta con dos asistentes independientes:
- **LibretaX Assistant (Público en Landing):** Responde dudas sobre qué hace LibretaX, funciones, planes y beneficios a visitantes. NO accede a cuentas privadas ni a base de datos operativa.
- **LibretaX Copilot (Privado en Dashboard):** Asistente dentro del dashboard que permite al usuario autenticado consultar en lenguaje natural sus datos reales ("¿Cuánto gané hoy?", "¿Qué producto tuvo mejor margen?", "¿Cómo vengo este mes comparado al anterior?").
- **Principio Fundamental:** La IA nunca inventa datos ni números. Los cálculos se realizan exclusivamente mediante herramientas canónicas del backend sobre datos reales auditados del tenant.
- **Flujo de Seguridad de Dos Pasos:** Para cualquier acción crítica (cambiar precios, pausar publicaciones, modificar stock), la IA solo prepara una previsualización y exige que el usuario escriba la palabra exacto 'CONFIRMO' antes de impactar en Mercado Libre.

## 9. PLANES, PRECIOS Y CONDICIONES COMERCIALES
${plansSummary}

Condiciones generales:
- Todos los planes cuentan con **15 días de prueba gratis** completa, sin necesidad de ingresar tarjeta de crédito al registrarse.
- Facturación mensual en USD o su equivalente en pesos argentinos vía Mercado Pago.
- Cancelación en cualquier momento sin penalizaciones ni contratos de permanencia.

## 10. PREGUNTAS FRECUENTES (FAQ)
- **¿LibretaX me garantiza vender más?**
  LibretaX no promete fórmulas mágicas; te da visibilidad exacta sobre qué productos te generan ganancia y cuáles te hacen perder dinero, permitiéndote tomar decisiones informadas sobre precios, promociones, stock y publicidad.
- **¿Mis datos están protegidos?**
  Sí. LibretaX utiliza arquitectura multi-tenant estricta con aislamiento por tenant (Row Level Security en base de datos) y encriptación de credenciales. Los datos de un comercio jamás son visibles ni accesibles para otros.
- **¿Cómo comienzo a usarlo?**
  Podés registrarte haciendo clic en el botón de "Crear cuenta" o "Registrarse" en la página principal. Tras registrarte, conectás tu cuenta de Mercado Libre en 1 clic y LibretaX comienza a sincronizar tus datos.
`.trim();
}

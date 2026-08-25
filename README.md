# Klyvo 📦🤖 (SaaS de Gestión Inteligente y Automatización para Mercado Libre)

**Klyvo** (también conocido internamente como **Stockly**) es una plataforma SaaS (Software as a Service) empresarial diseñada para transformar la gestión operativa de vendedores en Mercado Libre. No es un simple gestor de inventario; es un **operador inteligente del negocio** que combina flujos automatizados de back-office con una interfaz conversacional avanzada impulsada por Inteligencia Artificial (Web y WhatsApp) y analítica de rentabilidad de precisión unitaria.

---

## 🎯 Arquitectura de Negocio y Potencial

El valor diferenciador de Klyvo reside en su capacidad de eliminar el trabajo administrativo manual y automatizar decisiones operativas complejas bajo estrictas **barreras de seguridad contra fallas**. El sistema está optimizado para resolver tres problemas críticos de los vendedores en el ecosistema e-commerce de Latinoamérica:

1. **Prevención de Errores Operativos Críticos:** Automatiza cambios de stock y precio reduciendo a cero el riesgo de bloqueos o pérdidas por errores humanos gracias a su motor dinámico de estimación de riesgo.
2. **Cálculo Real de Rentabilidad Unitario:** Deduce en tiempo real las tarifas de Mercado Libre, costos de envío estimados, impuestos, costos financieros de cuotas (campañas de cuotas) y promociones, indicando el margen neto real de cada producto.
3. **Control Ubicuo (Omnicanalidad con AI):** Permite al vendedor auditar su negocio, cambiar precios, pausar publicaciones u obtener reportes de ventas consolidadas en lenguaje natural enviando mensajes de texto o notas de voz directamente desde su celular a través de **WhatsApp Cloud API**.

---

## 🚀 Capacidades y Características Técnicas

### 1. Integración Resiliente con Mercado Libre (Core API)
* **Tolerancia a Fallos y Autocuración de Credenciales:** El sistema cuenta con un gestor dinámico de tokens OAuth multi-tenant. En caso de detectar una expiración inminente del access token (umbral inferior a 10 minutos) o recibir un error `401 Unauthorized` de Mercado Libre, el cliente HTTP auto-refresca las credenciales de forma transparente en medio de la transacción y reintenta el request de inmediato. Si el refresh token también ha expirado, degrada la cuenta al estado de error, emite una alerta en tiempo real en la base de datos y genera un registro de auditoría (`audit_logs`) para mantener al usuario informado.
* **Control de Concurrencia y Rate Limiting:** Klyvo previene el bloqueo de peticiones por exceder la cuota API de Mercado Libre (`HTTP 429 Too Many Requests`). Cuenta con un servicio de control de tasa con concurrencia restringida (máximo 5 llamadas concurrentes y delay programado de 100ms) que encola las tareas en segundo plano.
* **Sincronización Inteligente en Paralelo:** Procesamiento aislado en segundo plano mediante `Promise.allSettled` para que fallas en un tenant particular no bloqueen la sincronización de los demás.

### 2. Motor de Inteligencia Artificial (OpenAI + Whisper + Vercel AI SDK)
* **Comprensión Conversacional Multi-Turno:** El agente almacena de forma persistente el historial del chat para inferir el contexto y las entidades involucradas en consultas secuenciales (ej. *"¿Cuánto vendí hoy?"* -> *"¿Y cuáles fueron los productos?"*).
* **Slot Filling Inteligente con Extracción de Entidades:** Si un comando requiere parámetros obligatorios que el usuario omitió en su mensaje original, la IA interrumpe el flujo, identifica los campos faltantes, interroga amigablemente al usuario y extrae la información faltante usando análisis de lenguaje natural dinámico (LLM Parsing) para proceder de forma estructurada.
* **Procesamiento de Voz Multicanal:** Transcripción y traducción en tiempo real de audios de WhatsApp o Web a través de **OpenAI Whisper-1**, permitiendo la interacción manos libres desde el celular.

### 3. Barreras de Seguridad y Prevención de Errores (Error Prevention Engine)
* **Evaluación Dinámica de Riesgo:** Antes de ejecutar cualquier comando de escritura (cambio de stock o precio) en Mercado Libre, el sistema evalúa su magnitud a través de un motor que clasifica la acción en riesgo `LOW`, `MEDIUM` o `HIGH`. Si se detecta un impacto masivo (más de 5 publicaciones pausadas o alteraciones superiores al 20% en precios), la acción se cataloga de alto riesgo.
* **Límites de Seguridad y Bloqueos Hard-coded:**
  * **Tope de Modificación de Precio:** Bloquea de forma inmediata cualquier intento de cambio de precio que varíe más del **30%** respecto al valor actual, solicitando revisión manual del administrador para evitar pérdidas por errores tipográficos (ej. poner `$100` en vez de `$1000`).
  * **Tope de Operaciones Masivas:** Limita a un máximo de **50 productos** por lote en modificaciones remotas para evitar daños colaterales.
* **Intersector de Confirmación de Dos Pasos:** Las acciones críticas (modificaciones en Mercado Libre o Base de Datos) nunca se aplican de inmediato. El backend las guarda como una acción pendiente (`ai_actions` en estado `pending`) y solicita confirmación explícita. El sistema **intercepta e ignora** respuestas ambiguas (como *"ok"*, *"si"*, *"dale"*), respondiendo con una advertencia de seguridad indicando que el usuario debe escribir exactamente la palabra **"confirmo"** o **"confirmar"** para autorizar la acción.

### 4. Inventario de Depósito y Bodega FULL Mercado Libre (Stock Interno)
* **Relación N-a-M de Componentes a Publicaciones:** Klyvo permite mapear un catálogo de materia prima o piezas individuales (ej. tornillos, gabinetes, pantallas, dijes) a las publicaciones finales vendidas en Mercado Libre. Cuando ocurre una venta, el inventario deduce proporcionalmente los componentes consumidos.
* **⚡ Bodega FULL Agrupada por SKU Único:** Módulo dedicado en `Stock Interno` (`/dashboard/internal-stock`) que sincroniza el inventario físico almacenado en las bodegas de Mercado Libre FULL. Agrupa inteligentemente las publicaciones por **SKU único normalizado**, evitando la duplicación de unidades entre publicaciones compartidas (ej. publicación Clásica vs Premium de un mismo producto).
* **Reabastecimiento Predictivo Basado en Demanda:** Analiza la velocidad de ventas en los últimos 30 días, proyecta el consumo de componentes de depósito y emite recomendaciones de reabastecimiento automáticas ajustadas a un **20% de stock de seguridad**.

### 5. Mercado Libre Product ADS (Publicidad & ROAS Real)
* **Aislamiento Estricto de ADS:** Módulo especializado (`/dashboard/ads`) enfocado únicamente en **Mercado Libre Product ADS** (publicidad patrocinada de presupuesto diario), distinguiéndola de promociones y cupones de descuento.
* **Cálculo de Ganancia Limpia Real por Anuncio:** Sincroniza consumo publicitario, clics, CPC y ventas atribuidas de cada anuncio en la campaña (ej. *Campaña Dijes y Cadenas*). Cruza los ingresos con el **costo de producto guardado en la Base de Datos**, comisiones de Mercado Libre y envío para mostrar la **Ganancia Limpia exacta en bolsillo** ($ y % neto).
* **Filtros Temporales en Tiempo Real:** Permite auditar la inversión y rentabilidad en múltiples ventanas de tiempo (`Últimos 30 días`, `Este Mes`, `Mes Anterior`, `Últimos 7 días`, `Hoy`, `Histórico Completo`), recalculando las métricas en vivo.

### 6. Gestión de Promociones y Cupones en Vivo
* **Sincronización en Tiempo Real con Seller Promotions API:** Conexión directa a la API de promociones del vendedor (`/seller-promotions/users/{user_id}?app_version=v2`), identificando ofertas activas y programadas (`SMART`, `DEAL`, `LIGHTNING`, `CUSTOM`) y campañas de cupones (`SELLER_COUPON_CAMPAIGN`).
* **Desglose de Descuentos Subvencionados por ML:** Consulta las publicaciones participantes de cada promoción (`/seller-promotions/promotions/{id}/items`) mostrando el precio original, el precio oferta final y el desglose de descuentos entre el **porcentaje a cargo del vendedor** y el **porcentaje financiado/subvencionado por Mercado Libre**.

### 7. Suscripciones y Facturación (Mercado Pago API)
* **Pasarela de Cobro Automatizada:** Sistema de planes (Starter, Pro, Ultra) controlado por el estado de las suscripciones en Mercado Pago (`subscription_preapproval`).
* **Manejo de Períodos de Gracia:** Si una suscripción es cancelada por el usuario, el webhook detecta el cambio pero mantiene activo el acceso de pago hasta que se cumpla la fecha exacta de vencimiento original (`expires_at`), degradando a la cuenta al plan básico recién al expirar el plazo pagado.

### 8. Workers Serverless en Segundo Plano (Inngest Queues)
* **Procesamiento Asíncrono e Inmune al Timeout:** Sincronizaciones recurrentes (órdenes cada 5 min, productos cada 15 min, alertas horarias) delegadas a **Inngest**. Esto evita el bloqueo de hilos de ejecución en el servidor Next.js y permite saltarse las limitaciones de tiempo de ejecución (timeouts) de las Edge o Serverless functions de Vercel.

---

## 🛠️ Stack Tecnológico

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui.
* **Diseño e Interactividad:** Estructura modular basada en componentes reutilizables con carga progresiva de interfaz. Uso de React Suspense para el streaming del Dashboard para lograr tiempos de carga instantáneos en secciones complejas (como estadísticas financieras).
* **Backend:** Next.js Server Actions y Route Handlers (Edge y Node.js runtimes).
* **Base de Datos & Seguridad:** Supabase (PostgreSQL, Row Level Security para aislamiento absoluto de tenants y autenticación segura integrada).
* **Orquestador de Tareas:** Inngest (Colas asíncronas con reintentos y lógica distribuida en pasos).
* **Inteligencia Artificial:** OpenAI API (`gpt-4o-mini`, `whisper-1`) y Vercel AI SDK.
* **Pasarelas e Integraciones de Terceros:** Mercado Libre API, Mercado Pago API, WhatsApp Cloud API.
* **Observabilidad y Monitoreo:** Sentry (monitoreo de errores a nivel cliente/servidor) y Logger estructurado con persistencia de logs de auditoría.

---

## 📂 Estructura de Código del Proyecto

* [src/app/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app): Contiene las rutas principales del frontend (Next.js App Router).
  * [api/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app/api): Controladores de Webhooks y APIs expuestas.
    * [mercadopago/webhook/route.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app/api/mercadopago/webhook/route.ts): Procesador de firmas y actualizaciones de suscripción de Mercado Pago.
  * [dashboard/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app/dashboard): Vistas del panel (Ventas, Stock, Productos, IA, Configuración).
* [src/components/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/components): Componentes interactivos reutilizables (tablas, skeletons).
* [src/services/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/services): Lógica de negocios encapsulada.
  * [ai/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/services/ai): Orquestador conversacional, gestión de memoria e interceptores de seguridad.
  * [meli/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/services/meli): Conectores con la API de Mercado Libre (sincronizaciones, token checkers, rate limiter).
* [src/jobs/](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/jobs): Tareas y Cron Jobs definidos para ejecutarse en Inngest.

---

## 🔍 Detalles e Integraciones Clave (Code Showcase)

### A. Cliente de Mercado Libre Auto-Sanable y Resiliente
Este fragmento en [src/services/meli/client.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/services/meli/client.ts) demuestra cómo Klyvo automatiza la renovación de tokens OAuth caducados y gestiona errores `401 Unauthorized` de forma transparente a mitad del flujo de petición:

```typescript
// Fragmento simplificado del wrapper del cliente HTTP de Mercado Libre
export async function meliFetch({
  tenantId,
  meliAccountId,
  endpoint,
  method = "GET",
  body
}: MeliFetchArgs): Promise<any> {
  const supabase = createAdminClient();
  
  // 1. Cargar las credenciales del tenant desde base de datos
  let query = supabase.from("meli_accounts").select("*");
  // ... resolución de cuenta por meliAccountId o tenantId ...
  const account = await query.single();
  let accessToken = account.access_token;

  // 2. Control Proactivo: Si el token expira en menos de 10 min, refrescarlo antes de hacer la llamada
  let needsRefresh = false;
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    const tenMinutes = 10 * 60 * 1000;
    if (expiresAt - Date.now() < tenMinutes) needsRefresh = true;
  }

  if (needsRefresh) {
    accessToken = await refreshMeliToken(account.id); // Lógica de renovación vía API oficial de ML
  }

  // 3. Ejecutar Petición
  const executeRequest = async (token: string) => {
    return fetch(`https://api.mercadolibre.com${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
  };

  let response = await executeRequest(accessToken);

  // 4. Control Reactivo: Si responde 401 (Token inválido en vuelo), renovar inmediatamente y reintentar
  if (response.status === 401) {
    console.warn("Received 401 from ML. Attempting token refresh...");
    try {
      accessToken = await refreshMeliToken(account.id);
      response = await executeRequest(accessToken); // Reintento con credenciales frescas
    } catch (refreshErr) {
      console.error("Refresh and retry failed");
    }
  }

  // 5. Manejo del Fallo Permanente: Desactivar cuenta, disparar alertas y registrar en auditoría
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      await supabase
        .from("meli_accounts")
        .update({ status: "error", sync_error: errorText })
        .eq("id", account.id);

      await createAlert({
        tenantId: account.tenant_id,
        title: "Fallo de comunicación con Mercado Libre",
        body: `La sincronización ha fallado: ${errorText.substring(0, 100)}`,
        severity: "error"
      });
    }
    
    throw new AppError("VALIDATION_ERROR", `Meli API Error: ${errorText}`, response.status);
  }

  return response.json();
}
```

### B. Interceptor de Seguridad Conversacional (AI Agent Guardrails)
Este fragmento en [src/services/ai/agent.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/services/ai/agent.ts) muestra la lógica de interceptación que fuerza al usuario a escribir exactamente la palabra **"confirmo"** o **"confirmar"** para poder ejecutar acciones destructivas previamente guardadas en cola, previniendo accidentes conversacionales:

```typescript
// Interceptor en el Orquestador del Agente de Inteligencia Artificial
export async function runBusinessAgent({ tenantId, userMessage, channel, fromPhone }) {
  // ... validaciones de límites de consumo mensual ...
  const session = await getActiveSession({ tenantId, channel, fromPhone });
  const lowerMsg = userMessage.trim().toLowerCase();
  
  const validConfirms = ['confirmo', 'confirmar', 'sí, confirmo', 'si, confirmo', 'si confirmo'];
  const invalidConfirms = ['ok', 'dale', 'si', 'sí', 'bueno', 'perfecto', 'listo', 'avanza', 'hacelo'];

  // Intercepta confirmación formal
  if (validConfirms.includes(lowerMsg)) {
    if (session && session.current_action_id) {
      const { confirmPendingAction } = await import('@/services/ai/actions/confirm');
      const res = await confirmPendingAction(tenantId, session.current_action_id);
      
      if (res.success) {
        await clearSessionState(session.id);
        return { response: "¡Acción confirmada y ejecutada con éxito en Mercado Libre!", product_id: null };
      }
      return { response: `Error al aplicar la acción: ${res.error}`, product_id: null };
    }
    return { response: "No tienes ninguna acción pendiente en esta conversación para confirmar.", product_id: null };
  }

  // Intercepta respuestas informales afirmativas pero peligrosas
  if (invalidConfirms.includes(lowerMsg)) {
    if (session && (session.current_action_id || session.current_workflow_id)) {
      return { 
        response: "⚠️ *Por seguridad*, debes escribir exactamente la palabra **'confirmo'** o **'confirmar'** para ejecutar esta acción crítica.", 
        product_id: null 
      };
    }
  }

  // Intercepta cancelaciones explícitas
  if (lowerMsg === 'cancelar' || lowerMsg === 'no') {
    if (session && session.current_action_id) {
      await cancelPendingAction(tenantId, session.current_action_id);
      await clearSessionState(session.id);
      return { response: "Acción cancelada. No se modificó nada en Mercado Libre.", product_id: null };
    }
  }
  
  // ... procesamiento normal del agente con OpenAI si no hay interceptaciones ...
}
```

### C. Webhook de Facturación con Período de Gracia (Mercado Pago Webhook)
Ubicado en [src/app/api/mercadopago/webhook/route.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app/api/mercadopago/webhook/route.ts), este fragmento procesa la firma secreta de seguridad del webhook y actualiza dinámicamente las licencias, manteniendo los servicios activos hasta la expiración real si el cliente canceló su suscripción:

```typescript
// Controlador de Webhook de suscripciones de Mercado Pago
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);

    // 1. Filtro de Seguridad: Validar token secreto del webhook
    const secret = url.searchParams.get("secret");
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && secret !== process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const id = url.searchParams.get("id") || url.searchParams.get("data.id");
    const type = url.searchParams.get("type");
    
    // ... lectura y normalización del body ...
    const topic = body.type || body.action || type;
    const resourceId = body.data?.id || id;

    if (topic === "subscription_preapproval" && resourceId) {
      const subscription = await getSubscription(resourceId); // Llamada API a Mercado Pago
      const externalReference = subscription.external_reference || "";
      const [refType, refId] = externalReference.split("_"); // Ej. "tenant_uuid"
      const status = subscription.status; // 'authorized', 'paused', 'cancelled'
      const plan = subscription.reason === 'Klyvo Ultra' ? 'ultra' : 'pro';

      if (refType && refId) {
        const supabase = createAdminClient();
        let targetPlan = plan;
        let isExpired = false;

        // Recuperar la suscripción actual en DB para evaluar el período de gracia
        const { data: currentSub } = await supabase.from('subscriptions').select('*').eq('tenant_id', refId).single();

        if (status === 'authorized') {
          targetPlan = plan;
        } else if (status === 'cancelled' || status === 'canceled') {
          // Lógica de Período de Gracia: Conservar acceso premium si todavía está en plazo pagado
          if (currentSub?.expires_at && new Date(currentSub.expires_at) > new Date()) {
            targetPlan = currentSub.plan; 
          } else {
            targetPlan = 'starter'; // Expiró el plazo, degradar cuenta
            isExpired = true;
          }
        }

        // Actualizar plan del tenant y base de suscripción
        await supabase.from("subscriptions").upsert({
          tenant_id: refId,
          plan: targetPlan,
          status: status === 'authorized' ? 'active' : 'canceled',
          mercadopago_subscription_id: subscription.id,
          expires_at: status === 'authorized' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : (isExpired ? null : currentSub?.expires_at),
        });

        await supabase.from("tenants").update({ plan: targetPlan }).eq("id", refId);
        logger.info(`Suscripción actualizada para ${refId} a plan ${targetPlan}`);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    Sentry.captureException(error);
    return new NextResponse("Error", { status: 500 });
  }
}
```

### D. Velocidad de Ventas y Reabastecimiento de Componentes (Smart Inventory)
El siguiente fragmento en [src/app/dashboard/internal-stock/actions.ts](file:///c:/Users/Nailen/Desktop/Proyectos/stockly/src/app/dashboard/internal-stock/actions.ts) ilustra cómo el sistema mapea órdenes finalizadas a consumos reales de depósito y estima la velocidad de ventas de los últimos 30 días junto con sugerencias de reabastecimiento:

```typescript
// Server Action para obtener inventario con análisis de velocidad de ventas
export async function getInventoryItems() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  const tenantId = profile?.tenant_id;

  // 1. Traer todos los items de depósito (componentes/materia prima)
  const { data: items } = await supabase.from("inventory_items").select("*").eq("tenant_id", tenantId);

  // 2. Traer órdenes realizadas en los últimos 30 días
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await supabase.from("orders").select("id").eq("tenant_id", tenantId).gt("date_created", thirtyDaysAgo);
  const orderIds = recentOrders?.map(o => o.id) || [];
  
  let salesPerComponent: Record<string, number> = {};

  if (orderIds.length > 0) {
    // Buscar items comprados en esas órdenes
    const { data: orderItems } = await supabase.from("order_items").select("product_id, quantity").in("order_id", orderIds);
    const productIds = Array.from(new Set(orderItems?.map(i => i.product_id).filter(Boolean))) as string[];

    if (productIds.length > 0) {
      // Cruzar con la tabla puente que define qué componentes tiene cada producto
      const { data: productComponents } = await supabase.from("product_components").select("product_id, inventory_item_id, quantity").in("product_id", productIds);

      // Calcular el volumen total de componentes consumidos
      orderItems?.forEach(item => {
        if (!item.product_id) return;
        const components = productComponents?.filter(c => c.product_id === item.product_id) || [];
        components.forEach(comp => {
          if (comp.inventory_item_id) {
            const qtyUsed = (item.quantity || 1) * (comp.quantity || 1);
            salesPerComponent[comp.inventory_item_id] = (salesPerComponent[comp.inventory_item_id] || 0) + qtyUsed;
          }
        });
      });
    }
  }

  // 3. Cruzar stock actual y estimar recomendación (+20% stock de seguridad)
  return items.map(item => {
    const salesLast30 = salesPerComponent[item.id] || 0;
    const targetStock = Math.ceil(salesLast30 * 1.2); // Proyección a 30 días + 20% margen de seguridad
    const recommended_restock = Math.max(0, targetStock - (item.current_stock || 0));
    
    return {
      ...item,
      sales_last_30_days: salesLast30,
      recommended_restock: salesLast30 > 0 ? recommended_restock : 0
    };
  });
}
```

---

*Desarrollado con foco en resiliencia de datos, prevención de fallas operativas y optimización automatizada de e-commerce impulsada por Inteligencia Artificial.*


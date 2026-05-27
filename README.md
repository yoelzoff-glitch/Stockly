# Klyvo 📦🤖

Klyvo es una plataforma SaaS (Software as a Service) de gestión, inteligencia y automatización diseñada específicamente para vendedores de Mercado Libre. Convierte a tu sistema no solo en un asistente operativo, sino en un **operador inteligente del negocio** que puede ser controlado mediante un Dashboard intuitivo o a través de lenguaje natural (Chat AI / WhatsApp).

---

## 🚀 Características Principales

### 1. Integración con Mercado Libre (Core)
- **OAuth Multi-tenant:** Conexión segura con Mercado Libre para múltiples vendedores (aislamiento de datos por tenant).
- **Sincronización de Productos:** Descarga y actualización automática del catálogo completo (precios, stock, estado, categoría, SKU).
- **Sincronización de Ventas (Órdenes):** Captura de órdenes recientes en tiempo real.
- **Manejo automático de Tokens:** Renovación automática (Refresh Token) en background para que la conexión nunca expire.
- **Acciones Directas:** Posibilidad de pausar, reactivar o cambiar el precio de los productos directamente desde Klyvo hacia Mercado Libre.

### 2. Panel de Control (Dashboard)
- **Productos:** Tabla detallada con el catálogo, permitiendo búsqueda, filtrado y edición de costos.
- **Ventas (Órdenes):** Visualización de las últimas ventas, apodo del comprador, monto total y estado de la orden (Pagado, Cancelado, Enviado).
- **Análisis de Competencia:** Búsqueda en tiempo real de publicaciones similares en Mercado Libre para comparar precios de competidores de forma directa.
- **Centro de Inteligencia (Chat AI):** Interfaz conversacional integrada en el dashboard para interactuar con el Agente de IA.
- **Integraciones:** Gestión de conexiones con Mercado Libre y WhatsApp.

### 3. Agente de IA (Intelligence Center)
- **Consultas en Lenguaje Natural:** El agente (impulsado por OpenAI) puede responder preguntas complejas como *"¿Cuántas ventas tuve hoy?"*, *"¿Qué productos tienen bajo stock?"*.
- **Ejecución de Acciones (Tools):** El agente tiene capacidad de pausar publicaciones, cambiar precios o activar productos previa confirmación de seguridad del usuario.
- **Soporte de Audio:** Posibilidad de enviarle notas de voz, las cuales son transcritas (Whisper) y procesadas.

### 4. Bot de WhatsApp Automático
- Integración oficial con WhatsApp Cloud API.
- Permite a los vendedores interactuar con el Agente de IA desde su celular.
- **Soporte Multimedia:** Acepta audios de WhatsApp, los transcribe y responde al vendedor con texto.

### 5. Rentabilidad y Costos
- **Cálculo de Margen Real:** Sistema avanzado que calcula la rentabilidad neta de cada producto.
- Considera: Precio de venta, Costo del producto (cargado por el usuario), Comisiones de ML (fee), Costos de envío estimados e impuestos.

### 6. Sistema de Suscripciones (Billing)
- Integración completa con **Mercado Pago**.
- Creación de planes de suscripción (Plan Básico, Plan Pro).
- Webhooks para activar o desactivar la cuenta del usuario según el estado de su pago.

### 7. Trabajos en Segundo Plano (Inngest)
- Sincronización automática de órdenes cada 5 minutos.
- Sincronización automática de productos cada 15 minutos.
- Evita cuellos de botella y mantiene el sistema actualizado sin intervención manual.

---

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui.
- **Backend:** Node.js, Next.js Server Actions, Route Handlers.
- **Base de Datos & Auth:** Supabase (PostgreSQL, Row Level Security, Auth Multi-tenant).
- **Automatización:** Inngest (Cron Jobs y colas de tareas).
- **Inteligencia Artificial:** OpenAI API (`gpt-4o`, `whisper-1`), Vercel AI SDK.
- **Pasarelas y APIs:** Mercado Libre API, Mercado Pago API, WhatsApp Cloud API.

---

## 📂 Estructura del Proyecto

- `/src/app/`: Rutas de la aplicación (Next.js App Router).
  - `/api/`: Endpoints (Webhooks, Inngest, Auth callbacks).
  - `/dashboard/`: Todas las pantallas del panel de control (Ventas, Productos, IA, Configuración).
- `/src/components/`: Componentes reutilizables de UI (botones, tablas, modales).
- `/src/services/`: Lógica de negocio core.
  - `/ai/`: Configuración del agente y tools.
  - `/meli/`: Llamadas a la API de Mercado Libre.
  - `/whatsapp/`: Integración con la mensajería.
  - `/billing/`: Funciones de suscripción y límites.
- `/supabase/`: Migraciones y esquemas SQL.

---

## ⚙️ Configuración y Variables de Entorno

El proyecto requiere las siguientes credenciales en el archivo `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Mercado Libre
NEXT_PUBLIC_MELI_APP_ID=...
MELI_CLIENT_SECRET=...
NEXT_PUBLIC_MELI_REDIRECT_URI=...

# OpenAI
OPENAI_API_KEY=...

# WhatsApp
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...
```

---

## 🚀 Despliegue

La aplicación está diseñada para ser desplegada sin fricciones en **Vercel**. 
El código aprovecha Server Components y Edge Functions cuando es necesario. Inngest maneja el background processing independiente del ciclo de vida del request HTTP de Vercel.

---
*Desarrollado para optimizar y escalar negocios en Mercado Libre con el poder de la Inteligencia Artificial.*

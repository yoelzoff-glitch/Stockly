"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Premium Header */}
      <div className="relative bg-gradient-to-b from-slate-900 to-indigo-950 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Link href="/">
            <Button variant="ghost" className="text-slate-300 hover:text-white mb-6 p-0 hover:bg-transparent flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver a la Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
            <span className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">Seguridad y Confianza</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Política de Privacidad
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            Última actualización: 26 de Mayo, 2026
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/80 space-y-8 prose prose-slate max-w-none">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. Nuestro Compromiso con la Privacidad</h2>
            <p className="text-slate-600 leading-relaxed">
              En Stockly, su privacidad y la seguridad de los datos de su negocio de comercio electrónico son nuestra máxima prioridad. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos la información cuando usted se registra y utiliza nuestra plataforma y asistente virtual de WhatsApp.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. Información que Recopilamos</h2>
            <p className="text-slate-600 leading-relaxed">
              Para brindar un servicio de optimización en tiempo real, recopilamos las siguientes categorías de datos:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Datos de la Cuenta de Mercado Libre:</strong> Con su autorización oficial vía OAuth, accedemos a sus publicaciones, títulos, precios, stock, ventas, costos e historial operativo para realizar los análisis de rentabilidad y sincronizaciones necesarias.</li>
              <li><strong>Información del Asistente (WhatsApp/Web):</strong> Almacenamos de forma temporal los mensajes y audios que usted envía a su número de asistente de Stockly únicamente con el fin de interpretar sus intenciones operativas y procesar las órdenes solicitadas mediante nuestra IA.</li>
              <li><strong>Datos de Registro y Perfil:</strong> Nombre, correo electrónico, ID de usuario y datos del inquilino (tenant) necesarios para la administración segura de su cuenta.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. Uso de la Información</h2>
            <p className="text-slate-600 leading-relaxed">
              Utilizamos los datos recopilados estrictamente para:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Brindar, operar, mantener y mejorar las funciones de automatización e inteligencia artificial de la plataforma.</li>
              <li>Procesar e interpretar sus comandos por WhatsApp y ejecutar los cambios correspondientes en Mercado Libre, previa confirmación por su parte.</li>
              <li>Prevenir fraudes, mitigar errores operativos de stock, y auditar transacciones.</li>
              <li>Enviar notificaciones y sugerencias de optimización para incrementar su rentabilidad.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. Transferencia Segura e Integraciones de Terceros</h2>
            <p className="text-slate-600 leading-relaxed">
              Stockly **nunca venderá, alquilará ni comercializará sus datos de ventas, clientes, proveedores o información comercial con terceros**.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Para el funcionamiento de la plataforma, nos integramos de forma segura y encriptada con:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>API de Mercado Libre:</strong> Para descargar y sincronizar su catálogo.</li>
              <li><strong>API de OpenAI:</strong> Para procesar las intenciones de texto, audios de WhatsApp y brindar recomendaciones de títulos optimizados. Los datos compartidos con OpenAI son anónimos, se transmiten por canales seguros y no se utilizan para entrenar modelos públicos externos.</li>
              <li><strong>Mercado Pago:</strong> Para el cobro seguro y recurrente de suscripciones, sin almacenar los datos de sus tarjetas de crédito o débito en nuestros servidores.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">5. Seguridad de los Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              Implementamos medidas de seguridad técnicas y administrativas avanzadas (incluyendo encriptación SSL/TLS de extremo a extremo, almacenamiento seguro en base de datos PostgreSQL, y control de accesos restringido) para proteger su información contra pérdida, robo, alteración o acceso no autorizado.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">6. Sus Derechos y Retención de Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              Usted tiene derecho a solicitar el acceso, rectificación, portabilidad o eliminación total de sus datos almacenados en Stockly en cualquier momento. Si decide cancelar su cuenta, todos los tokens de acceso OAuth y registros relacionados con su negocio serán eliminados permanentemente de nuestros servidores activos en un periodo no mayor a 30 días hábiles.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 border-b border-slate-100 pb-2">7. Contacto</h2>
            <p className="text-slate-600 leading-relaxed">
              Si tiene alguna pregunta, inquietud o reclamación relacionada con esta Política de Privacidad, puede ponerse en contacto con nuestro Oficial de Protección de Datos en <span className="font-semibold text-indigo-600">privacidad@stockly.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

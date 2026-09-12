"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import {
  trackLeadPopupView,
  trackLeadPopupDismiss,
  trackLeadPopupOptionSelected,
  trackGenerateLead,
} from "@/lib/analytics/ga";
import { trackWebEvent } from "@/components/analytics/WebAnalyticsTracker";

const LEAD_POPUP_DELAY = 18_000;
const SESSION_STORAGE_KEY = "libretax_landing_lead_popup_dismissed";

type ModalStep = "select" | "meeting" | "contact" | "success";

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export function LeadCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("select");
  const [successType, setSuccessType] = useState<"meeting" | "contact">("meeting");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Bot spam trap
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UTM attribution
  const [utmParams, setUtmParams] = useState<UTMParams>({});

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 1. Check session & trigger delay
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If dismissed in this session, do not schedule
    const isDismissed = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (isDismissed === "true") {
      return;
    }

    // Capture UTMs on mount
    try {
      const sp = new URLSearchParams(window.location.search);
      setUtmParams({
        utm_source: sp.get("utm_source") || undefined,
        utm_medium: sp.get("utm_medium") || undefined,
        utm_campaign: sp.get("utm_campaign") || undefined,
        utm_content: sp.get("utm_content") || undefined,
        utm_term: sp.get("utm_term") || undefined,
      });
    } catch (_) {}

    const timer = setTimeout(() => {
      // Re-check sessionStorage right before opening in case of multi-tab navigation
      if (sessionStorage.getItem(SESSION_STORAGE_KEY) !== "true") {
        previousActiveElementRef.current = document.activeElement as HTMLElement;
        setIsOpen(true);
        trackLeadPopupView("landing_popup");
      }
    }, LEAD_POPUP_DELAY);

    return () => clearTimeout(timer);
  }, []);

  // 2. Keyboard & Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
        return;
      }

      // Basic focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus modal when opened
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen, step]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    } catch (_) {}

    trackLeadPopupDismiss("landing_popup");
    setIsOpen(false);

    // Restore focus
    if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
    }
  };

  const handleSelectOption = (option: "meeting" | "contact") => {
    trackLeadPopupOptionSelected(option);
    setErrorMessage(null);
    setStep(option);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    const intent: "meeting" | "contact" = step === "meeting" ? "meeting" : "contact";

    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: step === "meeting" ? name.trim() : undefined,
          company: company.trim() || undefined,
          intent,
          source: "landing_popup",
          page_path: typeof window !== "undefined" ? window.location.pathname : "/",
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
          ...utmParams,
          // Honeypot field
          website: honeypot,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "No pudimos enviar tus datos. Intentá nuevamente.");
      }

      // Success: mark session dismissed
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
      } catch (_) {}

      // Track conversion
      trackGenerateLead(intent, "landing_popup");
      trackWebEvent("lead_generated", { intent, source: "landing_popup" });

      setSuccessType(intent);
      setStep("success");

      // Auto-close after ~3.5 seconds
      setTimeout(() => {
        setIsOpen(false);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || "No pudimos enviar tus datos. Intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Subtle backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-[#0B132B]/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-modal-title"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[490px] rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-[#DCDAD4] text-[#101828] outline-none z-10 overflow-hidden"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar ventana"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STEP 1: SELECT INTENT */}
            {step === "select" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#5B2FE4]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#102A56]">
                    Atención personalizada
                  </span>
                </div>

                <div className="space-y-2">
                  <h2
                    id="lead-modal-title"
                    className="text-xl sm:text-2xl font-extrabold text-[#101828] tracking-tight leading-snug"
                  >
                    ¿Querés ver LibretaX aplicado a tu negocio?
                  </h2>
                  <p className="text-sm text-[#5F6875] leading-relaxed">
                    Podemos mostrarte cómo analizar ventas, costos y rentabilidad de tu cuenta de Mercado Libre con LibretaX.
                  </p>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectOption("meeting")}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-all shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4]"
                  >
                    <Calendar className="w-4 h-4 text-[#A6F4C5]" />
                    <span>Solicitar una reunión</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectOption("contact")}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-semibold text-[#102A56] bg-[#F5F3EE] hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#102A56]"
                  >
                    <Mail className="w-4 h-4 text-[#5B2FE4]" />
                    <span>Prefiero que me contacten</span>
                  </button>
                </div>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs font-medium text-[#5F6875] hover:text-[#101828] underline underline-offset-4 transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: MEETING FORM */}
            {step === "meeting" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("select");
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#5F6875] hover:text-[#101828] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h2
                    id="lead-modal-title"
                    className="text-xl font-bold text-[#101828] tracking-tight"
                  >
                    Solicitar una reunión
                  </h2>
                  <p className="text-xs text-[#5F6875] leading-relaxed">
                    Dejanos tus datos y coordinamos un horario con vos.
                  </p>
                </div>

                {/* Invisible honeypot */}
                <div style={{ display: "none" }} aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label
                      htmlFor="lead-name"
                      className="block text-xs font-semibold text-[#101828] mb-1"
                    >
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lead-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-lg border border-[#DCDAD4] bg-white text-sm text-[#101828] placeholder-[#94A3B8] focus:border-[#5B2FE4] focus:ring-1 focus:ring-[#5B2FE4] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lead-email"
                      className="block text-xs font-semibold text-[#101828] mb-1"
                    >
                      Email comercial <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lead-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-lg border border-[#DCDAD4] bg-white text-sm text-[#101828] placeholder-[#94A3B8] focus:border-[#5B2FE4] focus:ring-1 focus:ring-[#5B2FE4] outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lead-company"
                      className="block text-xs font-semibold text-[#101828] mb-1"
                    >
                      Empresa o tienda en Mercado Libre <span className="text-xs font-normal text-[#5F6875]">(opcional)</span>
                    </label>
                    <input
                      id="lead-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Nombre de tu cuenta o marca"
                      disabled={isSubmitting}
                      className="w-full h-10 px-3 rounded-lg border border-[#DCDAD4] bg-white text-sm text-[#101828] placeholder-[#94A3B8] focus:border-[#5B2FE4] focus:ring-1 focus:ring-[#5B2FE4] outline-none transition-colors"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-all shadow-xs disabled:opacity-60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Solicitar reunión</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: CONTACT FORM */}
            {step === "contact" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("select");
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#5F6875] hover:text-[#101828] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h2
                    id="lead-modal-title"
                    className="text-xl font-bold text-[#101828] tracking-tight"
                  >
                    Prefiero que me contacten
                  </h2>
                  <p className="text-xs text-[#5F6875] leading-relaxed">
                    Dejanos tu email y nos ponemos en contacto.
                  </p>
                </div>

                {/* Invisible honeypot */}
                <div style={{ display: "none" }} aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="pt-1">
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold text-[#101828] mb-1"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    disabled={isSubmitting}
                    className="w-full h-10 px-3 rounded-lg border border-[#DCDAD4] bg-white text-sm text-[#101828] placeholder-[#94A3B8] focus:border-[#5B2FE4] focus:ring-1 focus:ring-[#5B2FE4] outline-none transition-colors"
                  />
                </div>

                {errorMessage && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                    {errorMessage}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-all shadow-xs disabled:opacity-60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#5B2FE4]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Quiero que me contacten</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: SUCCESS */}
            {step === "success" && (
              <div className="py-3 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#ECFDF3] border border-[#A6F4C5] flex items-center justify-center mx-auto text-[#027A48]">
                  <CheckCircle2 className="w-6 h-6 text-[#12B76A]" />
                </div>

                <div className="space-y-1.5">
                  <h2
                    id="lead-modal-title"
                    className="text-xl font-bold text-[#101828] tracking-tight"
                  >
                    {successType === "meeting"
                      ? "Solicitud recibida"
                      : "Listo, recibimos tu contacto"}
                  </h2>
                  <p className="text-sm text-[#5F6875] max-w-sm mx-auto leading-relaxed">
                    {successType === "meeting"
                      ? "Gracias. Nos vamos a poner en contacto para coordinar la reunión."
                      : "Nos vamos a comunicar con vos por email."}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-xs font-semibold text-[#102A56] bg-[#F5F3EE] hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

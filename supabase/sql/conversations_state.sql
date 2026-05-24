-- Tabla para mantener el estado de sesiones conversacionales multi-step

CREATE TABLE public.conversation_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    channel text NOT NULL DEFAULT 'web',
    phone_number text,
    status text NOT NULL DEFAULT 'active',
    current_workflow_id uuid,
    current_action_id uuid,
    current_action_type text,
    missing_fields jsonb DEFAULT '[]'::jsonb,
    context jsonb DEFAULT '{}'::jsonb,
    last_activity_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_conversation_sessions_tenant ON public.conversation_sessions USING btree (tenant_id);
CREATE INDEX idx_conversation_sessions_user ON public.conversation_sessions USING btree (user_id);
CREATE INDEX idx_conversation_sessions_phone ON public.conversation_sessions USING btree (phone_number);
CREATE INDEX idx_conversation_sessions_status ON public.conversation_sessions USING btree (status);

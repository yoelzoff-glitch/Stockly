create table if not exists public.subscription_usage (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) not null,
  month date not null,
  ai_credits_used integer default 0,
  whatsapp_messages_used integer default 0,
  automation_actions_used integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (tenant_id, month)
);

alter table public.subscription_usage enable row level security;

create policy "Users can read their tenant's usage"
  on public.subscription_usage
  for select
  using ( tenant_id in (select tenant_id from profiles where id = auth.uid()) );

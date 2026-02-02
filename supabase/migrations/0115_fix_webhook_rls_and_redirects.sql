-- 1. Garante que a tabela de configurações de Webhook seja acessível pelo Sistema (Service Role)
-- Isso evita o erro "RLS Policy Violation" quando o gatilho automático tenta ler para onde enviar os dados.
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access Webhooks" ON public.webhook_configs;
CREATE POLICY "Service Role Full Access Webhooks" ON public.webhook_configs
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- Garante que Admins também possam gerenciar
DROP POLICY IF EXISTS "Admins Manage Webhooks" ON public.webhook_configs;
CREATE POLICY "Admins Manage Webhooks" ON public.webhook_configs
FOR ALL TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);

-- 2. Garante que a tabela de Fretes (Shipping Rates) seja pública para leitura
-- Essencial para o cálculo de frete funcionar no N8N e no Checkout sem precisar de login admin
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Shipping Rates" ON public.shipping_rates;
CREATE POLICY "Public Read Shipping Rates" ON public.shipping_rates
FOR SELECT
USING (true);

-- 3. Garante que configurações globais (App Settings) sejam legíveis
-- Necessário para ler tokens de integração
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Read Settings" ON public.app_settings;
CREATE POLICY "Service Role Read Settings" ON public.app_settings
FOR SELECT TO service_role
USING (true);
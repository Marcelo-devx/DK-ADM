-- 1. Remove a função antiga que não suportava doações/fluxo novo
-- Isso garante que o frontend só consiga usar a função correta (create_pending_order_from_local_cart)
DROP FUNCTION IF EXISTS public.create_order_from_cart(numeric, jsonb);
DROP FUNCTION IF EXISTS public.create_order_from_cart(numeric, jsonb, bigint);

-- 2. LIMPEZA TOTAL DE GATILHOS (TRIGGERS) NA TABELA ORDERS
-- Removemos qualquer gatilho antigo que possa estar disparando webhooks duplicados
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
DROP TRIGGER IF EXISTS webhook_order_created ON public.orders;
DROP TRIGGER IF EXISTS trigger_order_created_webhook ON public.orders;

-- 3. Recria APENAS UM gatilho oficial para o Webhook
CREATE TRIGGER tr_single_order_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();
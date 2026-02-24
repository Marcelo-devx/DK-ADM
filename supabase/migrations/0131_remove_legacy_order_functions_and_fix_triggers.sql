-- LIMPEZA DEFINITIVA DE DUPLICIDADES

-- 1. Remove gatilhos duplicados conhecidos
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS tr_official_order_webhook_v2 ON public.orders;
DROP TRIGGER IF EXISTS tr_order_webhook_v3 ON public.orders;

-- 2. Remove funções antigas que podem estar sendo chamadas por engano
DROP FUNCTION IF EXISTS public.trigger_order_created_webhook() CASCADE;

-- 3. Cria a função de disparo limpa e única
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_payload jsonb;
BEGIN
  -- Payload enriquecido com dados básicos do pedido
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'total_price', NEW.total_price,
        'shipping_cost', NEW.shipping_cost,
        'coupon_discount', NEW.coupon_discount,
        'donation_amount', NEW.donation_amount,
        'status', NEW.status,
        'created_at', NEW.created_at
    )
  );

  -- Disparo ÚNICO para a Edge Function de despacho
  PERFORM net.http_post(
    url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook',
    body := v_payload,
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
    )
  );

  RETURN NEW;
END;
$function$;

-- 4. Cria o ÚNICO gatilho oficial
CREATE TRIGGER tr_order_webhook_final
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();
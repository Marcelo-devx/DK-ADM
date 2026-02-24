-- 1. LIMPEZA AGRESSIVA DE GATILHOS NA TABELA ORDERS
-- Removemos qualquer gatilho, não importa o nome, para recriar apenas o oficial.
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'orders' 
        AND trigger_schema = 'public'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t_name) || ' ON public.orders CASCADE';
    END LOOP;
END $$;

-- 2. LIMPEZA DE CONFIGURAÇÕES DE WEBHOOKS (EVITAR URLS DUPLICADAS/LIXO)
-- Mantém apenas o webhook mais recente para cada tipo de evento e deleta o resto.
DELETE FROM public.webhook_configs
WHERE id NOT IN (
    SELECT MAX(id)
    FROM public.webhook_configs
    GROUP BY trigger_event
);

-- 3. RECRIAÇÃO DA FUNÇÃO DE DISPARO (GARANTIA DE CÓDIGO ATUALIZADO)
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook_v5()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'net'
AS $function$
BEGIN
  -- Chama a Edge Function que gerencia o envio e os logs
  PERFORM net.http_post(
    url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook',
    body := jsonb_build_object(
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
    ),
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
    )
  );
  RETURN NEW;
END;
$function$;

-- 4. RECRIA O GATILHO ÚNICO
CREATE TRIGGER tr_order_webhook_v5_final
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook_v5();
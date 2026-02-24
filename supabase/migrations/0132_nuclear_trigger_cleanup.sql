-- LIMPEZA NUCLEAR DE GATILHOS

DO $$
DECLARE
    trigName RECORD;
BEGIN
    -- Busca TODOS os gatilhos na tabela orders que tenham nomes relacionados a webhook ou order
    FOR trigName IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'orders' 
        AND (trigger_name ILIKE '%webhook%' OR trigger_name ILIKE '%order%')
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trigName.trigger_name) || ' ON public.orders';
    END LOOP;
END $$;

-- Agora criamos o ÚNICO e DEFINITIVO gatilho
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook_v4()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'extensions', 'net'
AS $function$
BEGIN
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

CREATE TRIGGER zzz_order_webhook_official
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook_v4();
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_url text;
  v_payload jsonb;
  v_request_id bigint;
  v_headers jsonb;
BEGIN
  -- 1. URL CORRETA DA EDGE FUNCTION (Atualizado de trigger-integration para dispatch-webhook)
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  
  -- 2. Payload Padronizado
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'total_price', NEW.total_price,
        'status', NEW.status,
        'created_at', NEW.created_at
    )
  );

  -- 3. Headers com a chave de serviço (Service Role) para garantir que a Edge Function aceite
  -- Nota: Usamos a chave anônima pública aqui pois a Edge Function valida internamente
  v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
  );

  -- 4. Disparo Assíncrono via pg_net (Não trava o pedido se falhar)
  PERFORM net.http_post(
    url := v_url,
    body := v_payload,
    headers := v_headers
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log de erro no banco para debug, mas não impede a criação do pedido
  RAISE WARNING 'Falha silenciosa no Webhook N8N: %', SQLERRM;
  RETURN NEW;
END;
$function$;
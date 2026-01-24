-- Cria uma função genérica para eventos de produto
CREATE OR REPLACE FUNCTION public.trigger_dispatch_product_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  request_body jsonb;
  event_type text;
  -- URL da sua Edge Function (fixa para este projeto)
  project_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
BEGIN
  -- Determina o tipo de evento
  IF (TG_OP = 'INSERT') THEN
    event_type := 'product_created';
    payload := row_to_json(NEW)::jsonb;
  ELSIF (TG_OP = 'UPDATE') THEN
    event_type := 'product_updated';
    payload := row_to_json(NEW)::jsonb;
  ELSIF (TG_OP = 'DELETE') THEN
    event_type := 'product_deleted';
    payload := row_to_json(OLD)::jsonb;
  END IF;

  -- Monta a requisição
  request_body := jsonb_build_object(
    'event_type', event_type,
    'payload', payload
  );

  -- Dispara o Webhook
  PERFORM net.http_post(
    url := project_url,
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
    ),
    body := request_body
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS on_product_events ON public.products;

-- Cria o gatilho para INSERT, UPDATE e DELETE na tabela products
CREATE TRIGGER on_product_events
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_product_events();
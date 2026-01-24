-- Habilita a extensão para fazer requisições HTTP de dentro do banco
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função que monta o payload e chama a Edge Function
CREATE OR REPLACE FUNCTION public.trigger_dispatch_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
  request_body jsonb;
  -- URL da sua Edge Function (fixa para este projeto)
  project_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  -- Chave Anon para autorizar a chamada (pública e segura para este contexto)
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
BEGIN
  -- Converte a nova linha inserida (pedido) para JSON
  payload := row_to_json(NEW)::jsonb;
  
  -- Monta o corpo da requisição para o dispatch-webhook
  request_body := jsonb_build_object(
    'event_type', 'order_created',
    'payload', payload
  );

  -- Faz a chamada HTTP assíncrona (não trava a criação do pedido)
  PERFORM net.http_post(
    url := project_url,
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
    ),
    body := request_body
  );
  
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir para evitar duplicação
DROP TRIGGER IF EXISTS on_order_created_webhook ON public.orders;

-- Cria o gatilho: Sempre que um INSERT ocorrer em 'orders', execute a função acima
CREATE TRIGGER on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_dispatch_order_created();
-- Habilita a extensão para chamadas HTTP (caso não esteja habilitada)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função que será executada ao inserir um novo pedido
CREATE OR REPLACE FUNCTION public.handle_new_order_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_data jsonb;
  payload jsonb;
  request_body jsonb;
  headers jsonb;
  
  -- Configuração (Hardcoded para garantir execução sem depender de lookups falhos)
  edge_function_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
BEGIN
  -- 1. Buscar dados do cliente (Profile + Auth Email se possível, ou apenas Profile)
  -- Nota: Em triggers, acessar auth.users pode ser restrito, então focamos no public.profiles
  SELECT jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'phone', p.phone,
    'cpf', p.cpf_cnpj,
    'email', (SELECT email FROM auth.users WHERE id = p.id) -- Tenta buscar o email
  )
  INTO client_data
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  -- 2. Montar o Payload Completo
  payload := jsonb_build_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'total_price', NEW.total_price,
    'shipping_cost', NEW.shipping_cost,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'user_id', NEW.user_id,
    'shipping_address', NEW.shipping_address,
    'customer', client_data -- Inclui dados do cliente direto no disparo
  );

  request_body := jsonb_build_object(
    'event_type', 'order_created',
    'payload', payload
  );

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || anon_key
  );

  -- 3. Disparar a requisição POST para a Edge Function
  -- A Edge Function se encarregará de distribuir para os Webhooks configurados (N8N)
  PERFORM net.http_post(
    url := edge_function_url,
    headers := headers,
    body := request_body
  );

  RETURN NEW;
END;
$$;

-- Recriar o Trigger para garantir que ele é o único rodando essa lógica
DROP TRIGGER IF EXISTS on_order_created_dispatch ON public.orders;

CREATE TRIGGER on_order_created_dispatch
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_order_webhook();
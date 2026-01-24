-- 1. Habilita a extensão pg_net para fazer requisições HTTP de dentro do banco
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Função Genérica para Disparar o Webhook
CREATE OR REPLACE FUNCTION public.trigger_dispatch_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
  event_type text;
  edge_function_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  -- Em produção, idealmente isso viria de uma variável ou vault, mas aqui hardcoded para garantir funcionamento no setup atual
  service_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0NTY2NCwiZXhwIjoyMDY3NzkyMTY0fQ.AgMg76-4vQJ0Y_6P3KqV_HwJ7j3W7x8z9_k0L1m2n3o';
  request_id bigint;
BEGIN
  -- Define o tipo de evento e o payload
  IF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'product_created';
      payload := row_to_json(NEW)::jsonb;
    ELSIF TG_OP = 'UPDATE' THEN
      event_type := 'product_updated';
      payload := row_to_json(NEW)::jsonb;
    ELSIF TG_OP = 'DELETE' THEN
      event_type := 'product_deleted';
      payload := row_to_json(OLD)::jsonb;
    END IF;
  
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'order_created';
      payload := row_to_json(NEW)::jsonb;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Apenas dispara pagamento confirmado se o status mudou para pago/finalizada
      IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('Pago', 'Finalizada')) THEN
        event_type := 'payment_confirmed';
        payload := row_to_json(NEW)::jsonb;
      ELSE
        RETURN NEW; -- Ignora outras atualizações de pedido
      END IF;
    END IF;
  END IF;

  -- Se identificou um evento válido, faz o POST para a Edge Function
  IF event_type IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'event_type', event_type,
        'payload', payload
      )
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Recriar/Garantir os Triggers nas Tabelas

-- Trigger de Produtos
DROP TRIGGER IF EXISTS on_product_change_webhook ON products;
CREATE TRIGGER on_product_change_webhook
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook();

-- Trigger de Pedidos
DROP TRIGGER IF EXISTS on_order_change_webhook ON orders;
CREATE TRIGGER on_order_change_webhook
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_dispatch_webhook();
-- 1. Criar função que detecta mudanças de status relevantes
CREATE OR REPLACE FUNCTION public.trigger_order_status_change_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_url text;
  v_payload jsonb;
  v_event_type text;
BEGIN
  -- Só dispara se o status mudou E é um dos status relevantes
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Determina o tipo de evento baseado no novo status
    IF NEW.status = 'Pago' THEN
      v_event_type := 'order_paid';
    ELSIF NEW.status = 'Enviado' THEN
      v_event_type := 'order_shipped';
    ELSIF NEW.status IN ('Entregue', 'Finalizada') THEN
      v_event_type := 'order_delivered';
    ELSE
      -- Outros status não disparam webhook
      RETURN NEW;
    END IF;

    -- URL da edge function
    v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
    
    -- Payload com informações básicas (a edge function vai enriquecer)
    v_payload := jsonb_build_object(
      'event_type', v_event_type,
      'payload', jsonb_build_object(
          'order_id', NEW.id,
          'user_id', NEW.user_id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'total_price', NEW.total_price,
          'updated_at', NOW()
      )
    );

    -- Disparo assíncrono via pg_net
    PERFORM net.http_post(
      url := v_url,
      body := v_payload,
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
      )
    );

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log de erro silencioso, não impede a atualização do pedido
  RAISE WARNING 'Falha no webhook de status: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Criar o trigger
DROP TRIGGER IF EXISTS on_order_status_change_webhook ON public.orders;
CREATE TRIGGER on_order_status_change_webhook
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_status_change_webhook();

-- 3. Adicionar constraint de unicidade (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'webhook_configs_trigger_url_unique'
    ) THEN
        ALTER TABLE public.webhook_configs 
        ADD CONSTRAINT webhook_configs_trigger_url_unique 
        UNIQUE (trigger_event, target_url);
    END IF;
END $$;

-- 4. Inserir configurações de webhook no banco (se não existirem)
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES 
  ('order_paid', 'https://seu-n8n.com/webhook/pedido-pago', 'Notifica quando um pedido é marcado como Pago', true),
  ('order_shipped', 'https://seu-n8n.com/webhook/pedido-enviado', 'Notifica quando um pedido é enviado para entrega', true),
  ('order_delivered', 'https://seu-n8n.com/webhook/pedido-entregue', 'Notifica quando um pedido é entregue ao cliente', true)
ON CONFLICT (trigger_event, target_url) DO NOTHING;
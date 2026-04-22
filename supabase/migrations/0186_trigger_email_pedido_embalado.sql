-- ============================================================
-- MIGRATION 0186: Trigger para disparar e-mail via Resend
-- quando o delivery_status do pedido muda para 'Embalado'.
--
-- IMPORTANTE: Esta função é INDEPENDENTE dos triggers existentes.
-- Usa EXCEPTION WHEN OTHERS para nunca bloquear a operação principal.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_delivery_embalado_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
BEGIN
  -- Só age se delivery_status realmente mudou para 'Embalado'
  IF TG_OP = 'UPDATE'
     AND OLD.delivery_status IS DISTINCT FROM NEW.delivery_status
     AND NEW.delivery_status = 'Embalado' THEN

    PERFORM net.http_post(
      url     := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/send-order-email',
      body    := jsonb_build_object(
                   'event_type', 'order_packed',
                   'order_id',   NEW.id
                 ),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_anon_key
                 )
    );

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia a atualização do pedido
  RAISE WARNING '[email-trigger] Falha ao disparar e-mail de embalado (pedido %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir (idempotente)
DROP TRIGGER IF EXISTS tr_delivery_embalado_email ON public.orders;

-- Cria o trigger AFTER UPDATE (não interfere com BEFORE triggers existentes)
CREATE TRIGGER tr_delivery_embalado_email
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_delivery_embalado_email();

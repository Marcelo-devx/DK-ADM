-- ============================================================
-- MIGRATION 0183: Fix webhook triggers to use hardcoded anon_key
-- 
-- PROBLEM: Triggers using current_setting('request.header.authorization', true)
-- return null/empty when orders are created via RPC (checkout flow),
-- causing the webhook to fail silently with 'Bearer null' or 'Bearer '.
--
-- ROOT CAUSE: Migrations 0131, 0132, 0133 introduced dynamic header reading
-- which breaks when the order is created via create_pending_order_from_local_cart
-- (database RPC) because there is no HTTP request context available.
--
-- SOLUTION: Use the hardcoded anon_key (like migration 0098 which worked),
-- so the webhook always fires regardless of execution context (HTTP or RPC).
-- ============================================================

-- STEP 1: Drop ALL existing triggers on the orders table
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT DISTINCT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'orders' 
        AND trigger_schema = 'public'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t_name) || ' ON public.orders CASCADE';
        RAISE NOTICE 'Dropped trigger: %', t_name;
    END LOOP;
END $$;

-- STEP 2: Recreate the order_created webhook function with HARDCODED anon_key
-- The anon_key is the public/publishable key - safe to hardcode in DB functions
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'net'
AS $$
DECLARE
  -- Anon key hardcoded (public key, safe to use here - same as migration 0098 that worked)
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
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
        'Authorization', 'Bearer ' || v_anon_key
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[webhook] Falha no disparo do webhook order_created: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- STEP 3: Recreate the order_status_change webhook function with HARDCODED anon_key
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
  -- Anon key hardcoded (public key, safe to use here - same as migration 0098 that worked)
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
BEGIN
  -- Only fires if status changed AND is one of the relevant statuses
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Determine event type based on new status
    IF NEW.status = 'Pago' THEN
      v_event_type := 'order_paid';
    ELSIF NEW.status = 'Enviado' THEN
      v_event_type := 'order_shipped';
    ELSIF NEW.status IN ('Entregue', 'Finalizada') THEN
      v_event_type := 'order_delivered';
    ELSE
      -- Other statuses don't trigger webhook
      RETURN NEW;
    END IF;

    v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
    
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

    PERFORM net.http_post(
      url := v_url,
      body := v_payload,
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
      )
    );

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[webhook] Falha no disparo do webhook de status: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- STEP 4: Recreate the INSERT trigger (order_created)
CREATE TRIGGER tr_order_created_webhook_fixed
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook_final();

-- STEP 5: Recreate the UPDATE trigger (order_paid / order_shipped / order_delivered)
CREATE TRIGGER tr_order_status_change_webhook_fixed
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_status_change_webhook();

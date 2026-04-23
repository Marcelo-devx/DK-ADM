-- ============================================================
-- MIGRATION 0187: Auditoria completa da tabela orders
--
-- Registra QUALQUER UPDATE ou DELETE na tabela orders,
-- independente de quem fez ou por qual caminho:
-- admin panel, edge function, trigger, RPC, acesso direto ao banco.
--
-- Captura: quem fez (auth_uid, role), de onde (IP, user-agent,
-- path da requisição), quando, e exatamente o que mudou.
-- ============================================================

-- 1. Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.order_audit_log (
  id              bigserial PRIMARY KEY,
  order_id        bigint NOT NULL,
  operation       text NOT NULL,
  changed_fields  jsonb,
  row_before      jsonb,
  row_after       jsonb,
  auth_uid        uuid,
  db_user         text,
  app_role        text,
  client_ip       text,
  user_agent      text,
  request_path    text,
  audited_at      timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_audit_log_order_id   ON public.order_audit_log (order_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_log_auth_uid   ON public.order_audit_log (auth_uid);
CREATE INDEX IF NOT EXISTS idx_order_audit_log_audited_at ON public.order_audit_log (audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_audit_log_operation  ON public.order_audit_log (operation);

ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_adm" ON public.order_audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() = ANY (ARRAY['adm', 'gerente_geral']));

-- 2. Função de auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_auth_uid      uuid;
  v_app_role      text;
  v_client_ip     text;
  v_user_agent    text;
  v_request_path  text;
  v_changed       jsonb := '{}';
  v_row_before    jsonb;
  v_row_after     jsonb;
  v_col           text;
  v_old_val       text;
  v_new_val       text;
  v_tracked_cols  text[] := ARRAY[
    'status', 'delivery_status', 'payment_method',
    'total_price', 'shipping_cost', 'coupon_discount', 'donation_amount',
    'shipping_address', 'delivery_info', 'benefits_used',
    'crypto_hash', 'crypto_network', 'user_id', 'guest_email'
  ];
BEGIN
  BEGIN v_auth_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_auth_uid := NULL; END;

  BEGIN
    v_client_ip    := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    v_user_agent   := current_setting('request.headers', true)::jsonb->>'user-agent';
    v_request_path := current_setting('request.path', true);
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL; v_user_agent := NULL; v_request_path := NULL;
  END;

  IF v_auth_uid IS NOT NULL THEN
    BEGIN SELECT role INTO v_app_role FROM public.profiles WHERE id = v_auth_uid;
    EXCEPTION WHEN OTHERS THEN v_app_role := NULL; END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row_before := to_jsonb(OLD);
    v_row_after  := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_row_before := to_jsonb(OLD);
    v_row_after  := to_jsonb(NEW);
    FOREACH v_col IN ARRAY v_tracked_cols LOOP
      v_old_val := v_row_before->>v_col;
      v_new_val := v_row_after->>v_col;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changed := v_changed || jsonb_build_object(
          v_col, jsonb_build_object('de', v_old_val, 'para', v_new_val)
        );
      END IF;
    END LOOP;
    IF v_changed = '{}' THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.order_audit_log (
    order_id, operation, changed_fields, row_before, row_after,
    auth_uid, db_user, app_role, client_ip, user_agent, request_path, audited_at
  ) VALUES (
    COALESCE(OLD.id, NEW.id), TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN v_changed ELSE NULL END,
    v_row_before, v_row_after,
    v_auth_uid, current_user, v_app_role,
    v_client_ip, v_user_agent, v_request_path, now()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[audit] Falha ao registrar auditoria do pedido %: %', COALESCE(OLD.id, NEW.id), SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS tr_audit_orders ON public.orders;
CREATE TRIGGER tr_audit_orders
  AFTER UPDATE OR DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_orders();

-- 4. View amigável
CREATE OR REPLACE VIEW public.order_audit_log_view AS
SELECT
  al.id,
  al.order_id,
  al.operation,
  al.changed_fields,
  al.changed_fields->>'status'          AS status_change,
  al.changed_fields->>'delivery_status' AS delivery_status_change,
  al.changed_fields->>'payment_method'  AS payment_method_change,
  al.changed_fields->>'total_price'     AS total_price_change,
  al.changed_fields->>'shipping_cost'   AS shipping_cost_change,
  al.auth_uid,
  COALESCE(p.first_name || ' ' || p.last_name, 'Sistema / Trigger') AS actor_name,
  p.role    AS actor_role,
  al.db_user,
  al.client_ip,
  al.user_agent,
  al.request_path,
  al.audited_at,
  al.audited_at AT TIME ZONE 'America/Sao_Paulo' AS audited_at_brt
FROM public.order_audit_log al
LEFT JOIN public.profiles p ON p.id = al.auth_uid
ORDER BY al.audited_at DESC;

GRANT SELECT ON public.order_audit_log_view TO authenticated;

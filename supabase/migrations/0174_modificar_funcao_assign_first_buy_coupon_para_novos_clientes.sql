-- Modificar a função de atribuição de cupom de primeira compra
-- Atribui o cupom PRIMEIRACOMPRA apenas para clientes cadastrados a partir de HOJE
-- Corrige o problema de clientes antigos receberem o cupom indevidamente

CREATE OR REPLACE FUNCTION public.assign_first_buy_coupon_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_first_buy_coupon_id BIGINT;
  v_user_has_orders INT;
  v_cutoff_date DATE := CURRENT_DATE; -- Data de corte: hoje
BEGIN
  -- Verificar se é um novo cadastro (verificar se não tem pedidos)
  SELECT COUNT(*) INTO v_user_has_orders
  FROM orders
  WHERE user_id = NEW.id;
  
  -- Só atribuir se for realmente novo usuário (sem pedidos)
  -- E cadastrado a partir da data de corte (hoje)
  IF v_user_has_orders = 0 AND DATE(NEW.created_at) >= v_cutoff_date THEN
    -- Buscar o cupom PRIMEIRACOMPRA
    SELECT id INTO v_first_buy_coupon_id
    FROM coupons
    WHERE name = 'PRIMEIRACOMPRA' AND is_active = true
    LIMIT 1;
    
    -- Se o cupom existe, atribuir
    IF v_first_buy_coupon_id IS NOT NULL THEN
      -- Verificar se já não tem este cupom
      IF NOT EXISTS (
        SELECT 1 FROM user_coupons 
        WHERE user_id = NEW.id AND coupon_id = v_first_buy_coupon_id
      ) THEN
        INSERT INTO user_coupons (user_id, coupon_id, expires_at)
        VALUES (NEW.id, v_first_buy_coupon_id, NOW() + INTERVAL '180 days');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

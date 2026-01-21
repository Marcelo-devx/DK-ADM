CREATE OR REPLACE FUNCTION public.sync_loyalty_history()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_coupons_count integer;
  v_orders_count integer;
BEGIN
  -- 1. Sincronizar Cupons (Saída de Pontos)
  WITH inserted_coupons AS (
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type, created_at)
    SELECT 
        uc.user_id, 
        -(c.points_cost), 
        'Resgate de Cupom: ' || c.name, 
        'redeem',
        uc.created_at
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.loyalty_history lh 
        WHERE lh.user_id = uc.user_id 
        AND lh.operation_type = 'redeem' 
        AND lh.created_at = uc.created_at
    )
    RETURNING id
  )
  SELECT count(*) INTO v_coupons_count FROM inserted_coupons;

  -- 2. Sincronizar Pedidos Antigos (Entrada de Pontos)
  -- CORREÇÃO: Agora aceita qualquer status que NÃO seja Cancelado ou Pendente
  WITH inserted_orders AS (
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type, related_order_id, created_at)
    SELECT 
        o.user_id,
        FLOOR(o.total_price), -- 1 pra 1
        'Compra #' || o.id || ' (' || o.status || ')',
        'earn',
        o.id,
        o.created_at
    FROM public.orders o
    WHERE o.status NOT IN ('Cancelado', 'Pendente', 'Aguardando Pagamento') -- Pega Entregue, Finalizada, Pago, Enviado, etc.
    AND o.total_price > 0 -- Ignora pedidos zerados
    AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_history lh
        WHERE lh.related_order_id = o.id
    )
    RETURNING id
  )
  SELECT count(*) INTO v_orders_count FROM inserted_orders;

  -- 3. Atualizar o saldo total dos perfis
  UPDATE public.profiles p
  SET points = (
    SELECT COALESCE(SUM(points), 0)
    FROM public.loyalty_history lh
    WHERE lh.user_id = p.id
  )
  WHERE EXISTS (
    SELECT 1 FROM public.loyalty_history lh WHERE lh.user_id = p.id
  );
  
  RETURN 'Sincronização Forçada: ' || v_coupons_count || ' cupons e ' || v_orders_count || ' pedidos antigos recuperados.';
END;
$function$;
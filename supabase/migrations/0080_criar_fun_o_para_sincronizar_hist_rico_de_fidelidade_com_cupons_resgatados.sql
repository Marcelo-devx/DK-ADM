CREATE OR REPLACE FUNCTION public.sync_loyalty_history()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Insere registros de histórico para cupons que não têm registro correspondente
  WITH inserted AS (
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
  SELECT count(*) INTO v_count FROM inserted;
  
  RETURN 'Sincronização concluída. ' || v_count || ' registros recuperados.';
END;
$$;
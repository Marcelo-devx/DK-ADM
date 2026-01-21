CREATE OR REPLACE FUNCTION public.get_all_user_coupons_with_usage()
 RETURNS TABLE(
    id bigint, 
    created_at timestamp with time zone, 
    is_used boolean, 
    expires_at timestamp with time zone, 
    order_id bigint, 
    user_id uuid, 
    profile_first_name text, 
    profile_last_name text, 
    coupon_name text, 
    coupon_discount_value numeric,
    usage_date timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
BEGIN
  -- Verifica permissão de admin (Agora com acesso garantido ao auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'adm'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Requer privilégios de administrador.';
  END IF;

  RETURN QUERY
  SELECT 
    uc.id,
    uc.created_at,
    uc.is_used,
    uc.expires_at,
    uc.order_id,
    uc.user_id,
    p.first_name,
    p.last_name,
    c.name,
    c.discount_value,
    o.created_at as usage_date
  FROM user_coupons uc
  LEFT JOIN profiles p ON uc.user_id = p.id
  LEFT JOIN coupons c ON uc.coupon_id = c.id
  LEFT JOIN orders o ON uc.order_id = o.id
  ORDER BY uc.created_at DESC;
END;
$function$
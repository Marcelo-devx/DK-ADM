CREATE OR REPLACE FUNCTION public.get_all_user_coupons_admin()
RETURNS TABLE (
  id bigint,
  created_at timestamptz,
  is_used boolean,
  expires_at timestamptz,
  order_id bigint,
  user_id uuid,
  profile_first_name text,
  profile_last_name text,
  coupon_name text,
  coupon_discount_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica permissão de admin
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
    c.discount_value
  FROM user_coupons uc
  LEFT JOIN profiles p ON uc.user_id = p.id
  LEFT JOIN coupons c ON uc.coupon_id = c.id
  ORDER BY uc.created_at DESC;
END;
$$;
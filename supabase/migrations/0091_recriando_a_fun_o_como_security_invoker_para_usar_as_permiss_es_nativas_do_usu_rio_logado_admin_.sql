DROP FUNCTION IF EXISTS public.get_all_user_coupons_with_usage();

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
 SECURITY INVOKER
AS $function$
BEGIN
  -- A segurança agora é gerenciada pelas Políticas RLS da tabela (que já configuramos para permitir Admins)
  -- Isso remove a complexidade e erros de contexto.
  
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
  FROM public.user_coupons uc
  LEFT JOIN public.profiles p ON uc.user_id = p.id
  LEFT JOIN public.coupons c ON uc.coupon_id = c.id
  LEFT JOIN public.orders o ON uc.order_id = o.id
  ORDER BY uc.created_at DESC;
END;
$function$;
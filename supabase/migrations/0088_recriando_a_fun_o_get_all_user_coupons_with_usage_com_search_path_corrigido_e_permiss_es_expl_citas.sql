-- Remover a função anterior para garantir limpeza
DROP FUNCTION IF EXISTS public.get_all_user_coupons_with_usage();

-- Recriar com caminho de busca explícito e robusto
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
 SET search_path TO public, auth, extensions
AS $function$
DECLARE
  current_user_id uuid;
  is_admin boolean;
BEGIN
  -- Captura o ID do usuário de forma segura
  current_user_id := auth.uid();

  -- Verifica se é admin consultando a tabela de perfis
  SELECT (role = 'adm') INTO is_admin
  FROM public.profiles
  WHERE id = current_user_id;

  -- Se não for admin ou não estiver logado, bloqueia (retorna vazio ou erro)
  IF is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado. Usuário não é administrador.';
  END IF;

  -- Executa a consulta
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

-- Garantir permissão de execução para usuários logados
GRANT EXECUTE ON FUNCTION public.get_all_user_coupons_with_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_user_coupons_with_usage TO service_role;
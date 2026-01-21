CREATE OR REPLACE FUNCTION public.admin_delete_user_coupon(target_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
BEGIN
  -- Verifica permissão de admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'adm'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem excluir cupons.';
  END IF;

  DELETE FROM user_coupons WHERE id = target_id;
END;
$function$
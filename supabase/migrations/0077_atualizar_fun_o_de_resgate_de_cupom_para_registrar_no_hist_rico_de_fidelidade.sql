CREATE OR REPLACE FUNCTION public.redeem_coupon(coupon_id_to_redeem bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  user_points INT;
  coupon_cost INT;
  coupon_stock INT;
  v_coupon_name TEXT;
BEGIN
  -- 1. Validação de autenticação
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 2. Busca dados necessários com bloqueio de linha
  SELECT points INTO user_points FROM public.profiles WHERE id = current_user_id FOR UPDATE;
  SELECT name, points_cost, stock_quantity INTO v_coupon_name, coupon_cost, coupon_stock FROM public.coupons WHERE id = coupon_id_to_redeem FOR UPDATE;

  -- 3. Verificações de segurança
  IF coupon_cost IS NULL THEN
    RAISE EXCEPTION 'Cupom não encontrado.';
  END IF;

  IF coupon_stock <= 0 THEN
    RAISE EXCEPTION 'Este cupom está esgotado no momento.';
  END IF;

  IF user_points < coupon_cost THEN
    RAISE EXCEPTION 'Você precisa de % pontos para este cupom. Saldo atual: %.', coupon_cost, user_points;
  END IF;

  -- 4. Execução atômica das atualizações
  UPDATE public.profiles
  SET points = points - coupon_cost,
      updated_at = now()
  WHERE id = current_user_id;

  UPDATE public.coupons
  SET stock_quantity = stock_quantity - 1
  WHERE id = coupon_id_to_redeem;

  INSERT INTO public.user_coupons (user_id, coupon_id, expires_at)
  VALUES (current_user_id, coupon_id_to_redeem, (now() + interval '180 days'));

  -- 5. REGISTRAR NO HISTÓRICO (O que estava faltando)
  INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
  VALUES (current_user_id, -coupon_cost, 'Resgate de Cupom: ' || v_coupon_name, 'redeem');

  RETURN 'Cupom resgatado com sucesso!';
END;
$function$
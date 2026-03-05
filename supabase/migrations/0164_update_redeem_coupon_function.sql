-- Atualizar função de resgate de cupom para usar data de expiração em Brasília
CREATE OR REPLACE FUNCTION public.redeem_coupon(coupon_id_to_redeem INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_points INT;
  coupon_cost INT;
  coupon_stock INT;
  v_coupon_name TEXT;
  v_brasilia_now TIMESTAMP WITH TIME ZONE := public.brasilia_now();
BEGIN
  -- 1. Validação de autenticação
  IF current_user_id IS NULL THEN
    RETURN 'Usuário não autenticado';
  END IF;

  -- 2. Busca informações do usuário e cupom
  SELECT p.points INTO user_points
  FROM public.profiles p
  WHERE p.id = current_user_id;

  SELECT cost, stock, name INTO coupon_cost, coupon_stock, v_coupon_name
  FROM public.reward_coupons
  WHERE id = coupon_id_to_redeem;

  -- 3. Validações
  IF user_points IS NULL THEN
    RETURN 'Usuário não encontrado';
  END IF;

  IF coupon_cost IS NULL THEN
    RETURN 'Cupom não encontrado';
  END IF;

  IF coupon_stock <= 0 THEN
    RETURN 'Cupom esgotado';
  END IF;

  IF user_points < coupon_cost THEN
    RETURN 'Pontos insuficientes';
  END IF;

  -- 4. Debita pontos e registra no histórico
  UPDATE public.profiles
  SET points = points - coupon_cost
  WHERE id = current_user_id;

  INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
  VALUES (current_user_id, -coupon_cost, 'Resgate: ' || v_coupon_name, 'redemption');

  -- 5. Cria o cupom do usuário com validade de 180 dias em Brasília
  INSERT INTO public.user_coupons (user_id, coupon_id, expires_at)
  VALUES (current_user_id, coupon_id_to_redeem, v_brasilia_now + interval '180 days');

  -- 6. Diminui o estoque do cupom
  UPDATE public.reward_coupons
  SET stock = stock - 1
  WHERE id = coupon_id_to_redeem;

  RETURN 'Cupom resgatado com sucesso! Confira seus cupons.';
END;
$$;
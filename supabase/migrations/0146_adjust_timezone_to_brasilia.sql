-- Migration para ajustar fuso horário para Brasília (UTC-3)

-- Criar função helper para converter UTC para horário de Brasília
CREATE OR REPLACE FUNCTION public.brasilia_now()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NOW() AT TIME ZONE 'America/Sao_Paulo';
$$;

-- Criar função helper para obter a data atual em Brasília
CREATE OR REPLACE FUNCTION public.brasilia_date()
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo';
$$;

-- Atualizar função de aniversário para usar fuso horário de Brasília
CREATE OR REPLACE FUNCTION public.process_annual_birthday_bonus(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_birth_date DATE;
    v_bonus_amount INT;
    v_already_received BOOLEAN;
    v_brasilia_now TIMESTAMP WITH TIME ZONE := public.brasilia_now();
    v_current_year INT := EXTRACT(YEAR FROM v_brasilia_now);
BEGIN
    -- 1. Busca a data de nascimento e o valor do bônus configurado
    SELECT date_of_birth INTO v_birth_date FROM public.profiles WHERE id = p_user_id;
    SELECT COALESCE(value::int, 100) INTO v_bonus_amount FROM public.app_settings WHERE key = 'loyalty_birthday_bonus';

    -- Se não tem data de nascimento, não faz nada
    IF v_birth_date IS NULL THEN
        RETURN 'Data de nascimento não informada.';
    END IF;

    -- 2. Verifica se hoje é o dia/mês do aniversário (considerando fuso horário de Brasília)
    IF EXTRACT(DAY FROM v_birth_date) = EXTRACT(DAY FROM v_brasilia_now) AND 
       EXTRACT(MONTH FROM v_birth_date) = EXTRACT(MONTH FROM v_brasilia_now) THEN
       
       -- 3. TRAVA DE SEGURANÇA: Verifica se já ganhou este bônus no ano atual
       SELECT EXISTS (SELECT 1 FROM public.loyalty_history 
                     WHERE user_id = p_user_id 
                     AND operation_type = 'birthday_bonus'
                     AND EXTRACT(YEAR FROM created_at) = v_current_year
       ) INTO v_already_received;

       IF v_already_received THEN
           RETURN 'Bônus já concedido este ano.';
       END IF;

       -- 4. Concede os pontos e registra no histórico
       INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
       VALUES (p_user_id, v_bonus_amount, 'Parabéns! Bônus de Aniversário ' || v_current_year, 'birthday_bonus');

       UPDATE public.profiles 
       SET points = points + v_bonus_amount 
       WHERE id = p_user_id;

       RETURN 'Bônus concedido com sucesso!';
    END IF;

    RETURN 'Não é o dia do aniversário.';
END;
$$;

-- Atualizar função de cancelamento de pedidos expirados para usar Brasília
CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cancela pedidos aguardando pagamento há mais de 60 minutos (considerando Brasília)
  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE status = 'Aguardando Pagamento'
    AND created_at < (public.brasilia_now() - interval '60 minutes');
END;
$$;

-- Atualizar função de limpeza de carrinhos expirados para usar Brasília
CREATE OR REPLACE FUNCTION public.handle_expired_carts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_cart_record RECORD;
  item_record RECORD;
BEGIN
  -- Itera sobre os carrinhos criados há mais de 15 minutos (considerando Brasília)
  FOR expired_cart_record IN
    SELECT id FROM public.carts WHERE created_at < (public.brasilia_now() - interval '15 minutes')
  LOOP
    -- Devolve o estoque dos itens do carrinho
    FOR item_record IN
      SELECT product_id, variant_id, quantity FROM public.cart_items WHERE cart_id = expired_cart_record.id
    LOOP
      UPDATE public.products
      SET stock = stock + item_record.quantity
      WHERE id = item_record.product_id;

      -- Se tiver variant_id, atualiza também o estoque da variação
      IF item_record.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock = stock + item_record.quantity
        WHERE id = item_record.variant_id;
      END IF;
    END LOOP;

    -- Remove os itens do carrinho expirado
    DELETE FROM public.cart_items WHERE cart_id = expired_cart_record.id;

    -- Remove o carrinho expirado
    DELETE FROM public.carts WHERE id = expired_cart_record.id;
  END LOOP;
END;
$$;

-- Atualizar função de processamento de fidelidade para usar mês atual em Brasília
CREATE OR REPLACE FUNCTION public.process_loyalty_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_multiplier NUMERIC;
    v_base_points INT;
    v_bonus_points INT := 0;
    v_orders_this_month INT;
    v_referrer_id UUID;
    v_referral_record_id BIGINT;
    v_brasilia_now TIMESTAMP WITH TIME ZONE := public.brasilia_now();
BEGIN
    -- Processa pontos apenas quando o pedido é pago
    IF NEW.status IN ('Pago', 'Finalizada') AND (OLD.status NOT IN ('Pago', 'Finalizada')) THEN
        -- Calcula o multiplicador baseado no nível do cliente
        SELECT COALESCE(pt.points_multiplier, 1.0) INTO v_multiplier
        FROM public.profiles p
        LEFT JOIN public.loyalty_tiers pt ON p.loyalty_tier_id = pt.id
        WHERE p.id = NEW.user_id;

        -- Calcula os pontos base (1 ponto por real gasto)
        v_base_points := FLOOR(NEW.total_price * v_multiplier);

        -- BÔNUS EXTRA: Cliente que compra 3+ vezes no mês ganha +50% de pontos
        SELECT COUNT(*) INTO v_orders_this_month
        FROM public.orders
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND status IN ('Pago', 'Finalizada')
          AND date_trunc('month', created_at) = date_trunc('month', v_brasilia_now);

        IF v_orders_this_month >= 2 THEN -- +2 porque ainda vai contar este pedido
            v_bonus_points := FLOOR(v_base_points * 0.5);
        END IF;

        -- Concede os pontos e registra no histórico
        INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
        VALUES (
            NEW.user_id, 
            v_base_points + v_bonus_points, 
            'Pontos do pedido #' || NEW.id || (CASE WHEN v_bonus_points > 0 THEN ' +50% bônus recorrente' ELSE '' END),
            'order_points'
        );

        -- Atualiza o saldo de pontos do usuário
        UPDATE public.profiles
        SET points = points + v_base_points + v_bonus_points
        WHERE id = NEW.user_id;

        -- Recalcula o nível do usuário
        PERFORM public.recalculate_user_tier(NEW.user_id);

        -- Processa indicações (primeira compra)
        SELECT referrer_id INTO v_referrer_id
        FROM public.referrals
        WHERE referee_id = NEW.user_id;

        IF v_referrer_id IS NOT NULL THEN
            -- Verifica se já processou essa indicação
            SELECT id INTO v_referral_record_id
            FROM public.referrals
            WHERE referrer_id = v_referrer_id
              AND referee_id = NEW.user_id
              AND completed_at IS NULL;

            IF v_referral_record_id IS NOT NULL THEN
                -- Concede 500 pontos para quem indicou
                INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
                VALUES (
                    v_referrer_id, 
                    500, 
                    'Indicação: ' || COALESCE(
                        (SELECT first_name FROM public.profiles WHERE id = NEW.user_id),
                        'Amigo'
                    ) || ' comprou pela primeira vez',
                    'referral_bonus'
                );

                UPDATE public.profiles
                SET points = points + 500
                WHERE id = v_referrer_id;

                -- Marca a indicação como completa
                UPDATE public.referrals
                SET completed_at = v_brasilia_now
                WHERE id = v_referral_record_id;

                -- Recalcula o nível do quem indicou
                PERFORM public.recalculate_user_tier(v_referrer_id);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

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

  -- 5. Cria o cupom do usuário
  INSERT INTO public.user_coupons (user_id, coupon_id, expires_at)
  VALUES (current_user_id, coupon_id_to_redeem, v_brasilia_now + interval '180 days');

  -- 6. Diminui o estoque do cupom
  UPDATE public.reward_coupons
  SET stock = stock - 1
  WHERE id = coupon_id_to_redeem;

  RETURN 'Cupom resgatado com sucesso! Confira seus cupons.';
END;
$$;

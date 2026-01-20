-- Função para recalcular o nível do usuário baseado nos últimos 6 meses
CREATE OR REPLACE FUNCTION public.recalculate_user_tier(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_spend NUMERIC;
    v_new_tier_id INT;
    v_new_tier_name TEXT;
BEGIN
    -- 1. Calcula gasto total nos últimos 6 meses (apenas pedidos pagos/finalizados)
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_total_spend
    FROM public.orders
    WHERE user_id = target_user_id
      AND status IN ('Pago', 'Finalizada')
      AND created_at >= (NOW() - INTERVAL '6 months');

    -- 2. Descobre qual nível esse valor representa
    SELECT id, name INTO v_new_tier_id, v_new_tier_name
    FROM public.loyalty_tiers
    WHERE v_total_spend >= min_spend 
      AND (max_spend IS NULL OR v_total_spend <= max_spend)
    ORDER BY min_spend DESC
    LIMIT 1;

    -- 3. Atualiza o perfil
    UPDATE public.profiles
    SET 
        spend_last_6_months = v_total_spend,
        tier_id = v_new_tier_id,
        current_tier_name = v_new_tier_name,
        last_tier_update = NOW()
    WHERE id = target_user_id;
END;
$$;

-- Função Trigger para processar pontos após compra finalizada
CREATE OR REPLACE FUNCTION public.process_loyalty_on_order_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_multiplier NUMERIC;
    v_base_points INT;
    v_bonus_points INT := 0;
    v_orders_this_month INT;
    v_referrer_id UUID;
    v_referral_record_id BIGINT;
BEGIN
    -- Só roda se o status mudou para Pago ou Finalizada
    IF NEW.status IN ('Pago', 'Finalizada') AND OLD.status NOT IN ('Pago', 'Finalizada') THEN
        
        -- 1. Buscar multiplicador do nível atual
        SELECT t.points_multiplier INTO v_multiplier
        FROM public.profiles p
        JOIN public.loyalty_tiers t ON p.tier_id = t.id
        WHERE p.id = NEW.user_id;

        -- Pontos base
        v_base_points := FLOOR(NEW.total_price * COALESCE(v_multiplier, 1));

        -- 2. Bônus Ticket Alto (>500)
        IF NEW.total_price > 500 THEN
            v_bonus_points := v_bonus_points + 10;
        END IF;

        -- 3. Bônus Recorrência Mensal
        SELECT COUNT(*) INTO v_orders_this_month
        FROM public.orders
        WHERE user_id = NEW.user_id
          AND status IN ('Pago', 'Finalizada')
          AND date_trunc('month', created_at) = date_trunc('month', NOW());
        
        -- Nota: v_orders_this_month já inclui o pedido atual se a transação for após commit, 
        -- mas triggers rodam dentro. Vamos assumir contagem histórica + 1.
        -- Se é a 2ª compra (count=2), ganha 5.
        IF v_orders_this_month = 2 THEN v_bonus_points := v_bonus_points + 5; END IF;
        IF v_orders_this_month = 3 THEN v_bonus_points := v_bonus_points + 10; END IF;
        IF v_orders_this_month = 4 THEN v_bonus_points := v_bonus_points + 15; END IF;

        -- 4. Inserir pontos no histórico e perfil
        INSERT INTO public.loyalty_history (user_id, points, description, operation_type, related_order_id)
        VALUES (NEW.user_id, (v_base_points + v_bonus_points), 'Compra Aprovada #' || NEW.id, 'earn', NEW.id);

        UPDATE public.profiles 
        SET points = points + v_base_points + v_bonus_points
        WHERE id = NEW.user_id;

        -- 5. Recalcular nível (Tier)
        PERFORM public.recalculate_user_tier(NEW.user_id);

        -- 6. Lógica de Indicação (Member Get Member)
        -- Verifica se este usuário foi indicado e se é a PRIMEIRA compra válida
        SELECT id, referrer_id INTO v_referral_record_id, v_referrer_id
        FROM public.referrals
        WHERE referred_id = NEW.user_id AND status = 'registered';

        IF v_referral_record_id IS NOT NULL THEN
            -- Premia o indicador
            INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
            VALUES (v_referrer_id, 50, 'Bônus por Indicação Confirmada', 'earn');

            UPDATE public.profiles SET points = points + 50 WHERE id = v_referrer_id;

            -- Atualiza status da indicação
            UPDATE public.referrals SET status = 'completed' WHERE id = v_referral_record_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$;

-- Criar o Trigger na tabela Orders
DROP TRIGGER IF EXISTS on_order_paid_loyalty ON public.orders;
CREATE TRIGGER on_order_paid_loyalty
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.process_loyalty_on_order_complete();
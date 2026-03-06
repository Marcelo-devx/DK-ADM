-- Corrigir função de processamento de fidelidade para usar a coluna correta (tier_id em vez de loyalty_tier_id)
-- Problema: A função estava tentando fazer JOIN usando p.loyalty_tier_id, mas a coluna correta é p.tier_id
-- Isso causava erro quando o n8n tentava atualizar o status do pedido

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
        LEFT JOIN public.loyalty_tiers pt ON p.tier_id = pt.id
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

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
    
    -- Variáveis de Configuração
    cfg_ticket_threshold NUMERIC;
    cfg_ticket_bonus INT;
    cfg_rec_2 INT;
    cfg_rec_3 INT;
    cfg_rec_4 INT;
    cfg_ref_bonus INT;
BEGIN
    -- Só roda se o status mudou para Pago ou Finalizada
    IF NEW.status IN ('Pago', 'Finalizada') AND OLD.status NOT IN ('Pago', 'Finalizada') THEN
        
        -- Carregar configurações do banco (com falback para valores padrão se não encontrar)
        SELECT COALESCE(value::numeric, 500) INTO cfg_ticket_threshold FROM public.app_settings WHERE key = 'loyalty_ticket_threshold';
        SELECT COALESCE(value::int, 10) INTO cfg_ticket_bonus FROM public.app_settings WHERE key = 'loyalty_ticket_bonus';
        SELECT COALESCE(value::int, 5) INTO cfg_rec_2 FROM public.app_settings WHERE key = 'loyalty_recurrence_2nd';
        SELECT COALESCE(value::int, 10) INTO cfg_rec_3 FROM public.app_settings WHERE key = 'loyalty_recurrence_3rd';
        SELECT COALESCE(value::int, 15) INTO cfg_rec_4 FROM public.app_settings WHERE key = 'loyalty_recurrence_4th';
        SELECT COALESCE(value::int, 50) INTO cfg_ref_bonus FROM public.app_settings WHERE key = 'loyalty_referral_bonus';

        -- 1. Buscar multiplicador do nível atual
        SELECT t.points_multiplier INTO v_multiplier
        FROM public.profiles p
        JOIN public.loyalty_tiers t ON p.tier_id = t.id
        WHERE p.id = NEW.user_id;

        -- Pontos base (Valor * Multiplicador)
        v_base_points := FLOOR(NEW.total_price * COALESCE(v_multiplier, 1));

        -- 2. Bônus Ticket Alto
        IF NEW.total_price >= cfg_ticket_threshold THEN
            v_bonus_points := v_bonus_points + cfg_ticket_bonus;
        END IF;

        -- 3. Bônus Recorrência Mensal
        SELECT COUNT(*) INTO v_orders_this_month
        FROM public.orders
        WHERE user_id = NEW.user_id
          AND status IN ('Pago', 'Finalizada')
          AND date_trunc('month', created_at) = date_trunc('month', NOW());
        
        IF v_orders_this_month = 2 THEN v_bonus_points := v_bonus_points + cfg_rec_2; END IF;
        IF v_orders_this_month = 3 THEN v_bonus_points := v_bonus_points + cfg_rec_3; END IF;
        IF v_orders_this_month >= 4 THEN v_bonus_points := v_bonus_points + cfg_rec_4; END IF;

        -- 4. Inserir pontos no histórico e perfil
        INSERT INTO public.loyalty_history (user_id, points, description, operation_type, related_order_id)
        VALUES (NEW.user_id, (v_base_points + v_bonus_points), 'Compra #' || NEW.id, 'earn', NEW.id);

        UPDATE public.profiles 
        SET points = points + v_base_points + v_bonus_points
        WHERE id = NEW.user_id;

        -- 5. Recalcular nível (Tier)
        PERFORM public.recalculate_user_tier(NEW.user_id);

        -- 6. Lógica de Indicação (Member Get Member)
        SELECT id, referrer_id INTO v_referral_record_id, v_referrer_id
        FROM public.referrals
        WHERE referred_id = NEW.user_id AND status = 'registered';

        IF v_referral_record_id IS NOT NULL THEN
            -- Premia o indicador com o valor configurado
            INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
            VALUES (v_referrer_id, cfg_ref_bonus, 'Bônus por Indicação', 'earn');

            UPDATE public.profiles SET points = points + cfg_ref_bonus WHERE id = v_referrer_id;

            UPDATE public.referrals SET status = 'completed' WHERE id = v_referral_record_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$;
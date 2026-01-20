CREATE OR REPLACE FUNCTION public.process_annual_birthday_bonus(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_birth_date DATE;
    v_bonus_amount INT;
    v_already_received BOOLEAN;
    v_current_year INT := EXTRACT(YEAR FROM NOW());
BEGIN
    -- 1. Busca a data de nascimento e o valor do bônus configurado
    SELECT date_of_birth INTO v_birth_date FROM public.profiles WHERE id = p_user_id;
    SELECT COALESCE(value::int, 100) INTO v_bonus_amount FROM public.app_settings WHERE key = 'loyalty_birthday_bonus';

    -- Se não tem data de nascimento, não faz nada
    IF v_birth_date IS NULL THEN
        RETURN 'Data de nascimento não informada.';
    END IF;

    -- 2. Verifica se hoje é o dia/mês do aniversário (considerando fuso horário local)
    IF EXTRACT(DAY FROM v_birth_date) = EXTRACT(DAY FROM NOW()) AND 
       EXTRACT(MONTH FROM v_birth_date) = EXTRACT(MONTH FROM NOW()) THEN
       
       -- 3. TRAVA DE SEGURANÇA: Verifica se já ganhou este bônus no ano atual
       SELECT EXISTS (
           SELECT 1 FROM public.loyalty_history 
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
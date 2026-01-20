CREATE OR REPLACE FUNCTION public.update_birth_date(p_date date)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_locked BOOLEAN;
BEGIN
    SELECT birth_date_locked INTO v_is_locked FROM public.profiles WHERE id = v_user_id;

    IF v_is_locked THEN
        RAISE EXCEPTION 'A data de aniversário já foi definida e não pode ser alterada.';
    END IF;

    UPDATE public.profiles
    SET 
        date_of_birth = p_date,
        birth_date_locked = TRUE
    WHERE id = v_user_id;

    -- Se o aniversário for hoje ou este mês (opcional, aqui dando bônus de cadastro de data)
    -- Vamos dar 100 pontos como "Presente de Boas Vindas ao Clube" por preencher o dado
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
    VALUES (v_user_id, 100, 'Bônus Cadastro de Aniversário', 'earn');

    UPDATE public.profiles SET points = points + 100 WHERE id = v_user_id;
END;
$$;
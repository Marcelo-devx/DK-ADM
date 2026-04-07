-- Função para atribuir um cupom a um usuário específico (PERMITINDO DUPLICATAS)
-- Esta versão permite atribuir o mesmo cupom múltiplas vezes ao mesmo cliente
-- Útil para o setor de premiação, que pode precisar dar várias premiações para o mesmo cliente

-- Removido: Verificação de duplicidade (v_existing_count)
-- Removido: Verificação de estoque (já que todos são ilimitados agora)
-- Removido: Decremento de estoque (já que todos são ilimitados agora)
-- Adicionado: Contagem de cupons após inserção para mensagem informativa

CREATE OR REPLACE FUNCTION public.assign_coupon_to_user(
    p_user_id uuid,
    p_coupon_id bigint,
    p_expires_days integer DEFAULT 90
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon_name text;
    v_user_name text;
    v_total_coupons integer;
BEGIN
    -- Verificar se o usuário atual é admin
    IF NOT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() AND role = 'adm'
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem atribuir cupons manualmente';
    END IF;

    -- Verificar se o cupom existe e está ativo
    SELECT name INTO v_coupon_name
    FROM coupons
    WHERE id = p_coupon_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 'Erro: Cupom não encontrado ou não está ativo.';
    END IF;

    -- Obter nome do usuário para log
    SELECT first_name INTO v_user_name
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN 'Erro: Usuário não encontrado.';
    END IF;

    -- REMOVIDO: Verificação se o usuário já tem este cupom
    -- REMOVIDO: Verificação de estoque (agora todos são ilimitados)

    -- Inserir o cupom para o usuário (PERMITE DUPLICATAS)
    INSERT INTO user_coupons (user_id, coupon_id, expires_at)
    VALUES (p_user_id, p_coupon_id, NOW() + (p_expires_days || ' days')::interval);

    -- REMOVIDO: Decremento de estoque (agora todos são ilimitados)

    -- Contar total de cupons do usuário
    SELECT COUNT(*) INTO v_total_coupons
    FROM user_coupons
    WHERE user_id = p_user_id AND coupon_id = p_coupon_id AND is_used = false;

    -- Retornar mensagem apropriada
    IF v_total_coupons = 1 THEN
        RETURN format('Sucesso: Cupom "%s" atribuído ao usuário %s com validade de %d dias.', 
                      v_coupon_name, v_user_name, p_expires_days);
    ELSE
        RETURN format('Sucesso: Cupom "%s" atribuído novamente ao usuário %s (agora possui %d cupons disponíveis).', 
                      v_coupon_name, v_user_name, v_total_coupons);
    END IF;
END;
$$;

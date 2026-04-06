-- Função para atribuir um cupom a um usuário específico
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
    v_coupon_stock integer;
    v_coupon_name text;
    v_user_name text;
    v_existing_count integer;
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
    SELECT stock_quantity, name INTO v_coupon_stock, v_coupon_name
    FROM coupons
    WHERE id = p_coupon_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 'Erro: Cupom não encontrado ou não está ativo.';
    END IF;

    -- Verificar estoque (se não for ilimitado)
    IF v_coupon_stock != -1 AND v_coupon_stock <= 0 THEN
        RETURN 'Erro: Este cupom não possui estoque disponível.';
    END IF;

    -- Obter nome do usuário para log
    SELECT first_name INTO v_user_name
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN 'Erro: Usuário não encontrado.';
    END IF;

    -- Verificar se o usuário já tem este cupom
    SELECT COUNT(*) INTO v_existing_count
    FROM user_coupons
    WHERE user_id = p_user_id AND coupon_id = p_coupon_id AND is_used = false;

    IF v_existing_count > 0 THEN
        RETURN 'Info: O usuário já possui este cupom disponível.';
    END IF;

    -- Inserir o cupom para o usuário
    INSERT INTO user_coupons (user_id, coupon_id, expires_at)
    VALUES (p_user_id, p_coupon_id, NOW() + (p_expires_days || ' days')::interval);

    -- Decrementar estoque (se não for ilimitado)
    IF v_coupon_stock != -1 THEN
        UPDATE coupons
        SET stock_quantity = stock_quantity - 1
        WHERE id = p_coupon_id;
    END IF;

    RETURN format('Sucesso: Cupom "%s" atribuído ao usuário %s com validade de %d dias.', 
                  v_coupon_name, v_user_name, p_expires_days);
END;
$$;

-- Função para atribuir um cupom a todos os clientes ativos
CREATE OR REPLACE FUNCTION public.assign_coupon_to_all_clients(
    p_coupon_id bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupon_stock integer;
    v_coupon_name text;
    v_assigned_count integer := 0;
    v_skipped_count integer := 0;
    v_expires_days integer := 90; -- Padrão de 90 dias
    user_cursor CURSOR FOR 
        SELECT id, first_name, last_name
        FROM profiles
        WHERE id NOT IN (
            SELECT DISTINCT user_id 
            FROM user_coupons 
            WHERE coupon_id = p_coupon_id AND is_used = false
        );
    v_user_id uuid;
    v_first_name text;
    v_last_name text;
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
    SELECT stock_quantity, name INTO v_coupon_stock, v_coupon_name
    FROM coupons
    WHERE id = p_coupon_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 'Erro: Cupom não encontrado ou não está ativo.';
    END IF;

    -- Se o cupom não for ilimitado, verificar se tem estoque suficiente
    IF v_coupon_stock != -1 THEN
        -- Contar quantos usuários não tem o cupom ainda
        DECLARE
            v_users_without_coupon integer;
        BEGIN
            SELECT COUNT(DISTINCT p.id) INTO v_users_without_coupon
            FROM profiles p
            WHERE p.id NOT IN (
                SELECT DISTINCT uc.user_id 
                FROM user_coupons uc 
                WHERE uc.coupon_id = p_coupon_id AND uc.is_used = false
            );
            
            IF v_users_without_coupon > v_coupon_stock THEN
                RETURN format('Erro: Estoque insuficiente. Cupom tem %d unidades, mas %d usuários não possuem este cupom.',
                             v_coupon_stock, v_users_without_coupon);
            END IF;
        END;
    END IF;

    -- Atribuir cupom a cada usuário que ainda não tem
    OPEN user_cursor;
    LOOP
        FETCH user_cursor INTO v_user_id, v_first_name, v_last_name;
        EXIT WHEN NOT FOUND;

        -- Inserir o cupom para o usuário
        INSERT INTO user_coupons (user_id, coupon_id, expires_at)
        VALUES (v_user_id, p_coupon_id, NOW() + (v_expires_days || ' days')::interval);

        v_assigned_count := v_assigned_count + 1;

        -- Decrementar estoque (se não for ilimitado)
        IF v_coupon_stock != -1 THEN
            UPDATE coupons
            SET stock_quantity = stock_quantity - 1
            WHERE id = p_coupon_id;
        END IF;
    END LOOP;
    CLOSE user_cursor;

    RETURN format('Sucesso: Cupom "%s" atribuído a %d clientes com validade de %d dias.',
                  v_coupon_name, v_assigned_count, v_expires_days);
END;
$$;

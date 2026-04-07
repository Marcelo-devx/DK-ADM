-- Fix format specifier error: PostgreSQL format() does not support %d
-- Replace %d with %s for integer formatting in both coupon assignment functions

-- ============================================
-- FUNCTION 1: assign_coupon_to_user
-- ============================================

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

    -- Inserir o cupom para o usuário (PERMITE DUPLICATAS)
    INSERT INTO user_coupons (user_id, coupon_id, expires_at)
    VALUES (p_user_id, p_coupon_id, NOW() + (p_expires_days || ' days')::interval);

    -- Contar total de cupons do usuário
    SELECT COUNT(*) INTO v_total_coupons
    FROM user_coupons
    WHERE user_id = p_user_id AND coupon_id = p_coupon_id AND is_used = false;

    -- Retornar mensagem apropriada (FIX: Changed %d to %s)
    IF v_total_coupons = 1 THEN
        RETURN format('Sucesso: Cupom "%s" atribuído ao usuário %s com validade de %s dias.', 
                      v_coupon_name, v_user_name, p_expires_days::text);
    ELSE
        RETURN format('Sucesso: Cupom "%s" atribuído novamente ao usuário %s (agora possui %s cupons disponíveis).', 
                      v_coupon_name, v_user_name, v_total_coupons::text);
    END IF;
END;
$$;

-- ============================================
-- FUNCTION 2: assign_coupon_to_all_clients
-- ============================================

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
                -- FIX: Changed %d to %s in error message
                RETURN format('Erro: Estoque insuficiente. Cupom tem %s unidades, mas %s usuários não possuem este cupom.',
                             v_coupon_stock::text, v_users_without_coupon::text);
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

    -- FIX: Changed %d to %s in success message
    RETURN format('Sucesso: Cupom "%s" atribuído a %s clientes com validade de %s dias.',
                  v_coupon_name, v_assigned_count::text, v_expires_days::text);
END;
$$;

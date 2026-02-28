DO $$
DECLARE
    user_uuid UUID;
    black_tier_id INT;
    black_tier_name TEXT;
BEGIN
    -- Encontra o ID do usuário pelo e-mail
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'balanarownage@gmail.com' LIMIT 1;

    -- Encontra os detalhes do nível "Black"
    SELECT id, name INTO black_tier_id, black_tier_name FROM loyalty_tiers WHERE name ILIKE 'black' LIMIT 1;

    -- Se ambos forem encontrados, executa as atualizações
    IF user_uuid IS NOT NULL AND black_tier_id IS NOT NULL THEN
        -- 1. Atualiza o nível do perfil
        UPDATE public.profiles
        SET 
            tier_id = black_tier_id,
            current_tier_name = black_tier_name
        WHERE id = user_uuid;

        -- 2. Adiciona os pontos de bônus
        PERFORM admin_adjust_points(user_uuid, 10000, 'Bônus administrativo para upgrade para o nível Black');
    END IF;
END $$;
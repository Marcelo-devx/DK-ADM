CREATE OR REPLACE FUNCTION public.admin_adjust_points(
    target_user_id UUID,
    points_delta INTEGER,
    reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Registrar no histórico
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
    VALUES (target_user_id, points_delta, reason, 'adjustment');

    -- 2. Atualizar saldo do perfil
    UPDATE public.profiles
    SET points = points + points_delta
    WHERE id = target_user_id;

    -- 3. Opcional: Recalcular nível caso a regra mudasse para usar pontos totais (por enquanto é por gasto, mas mal não faz)
    -- PERFORM public.recalculate_user_tier(target_user_id);
END;
$$;
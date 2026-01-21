CREATE OR REPLACE FUNCTION public.get_all_loyalty_history_admin()
RETURNS TABLE(
    id bigint,
    user_id uuid,
    points integer,
    description text,
    created_at timestamp with time zone,
    operation_type text,
    profile_first_name text,
    profile_last_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, extensions
AS $function$
BEGIN
    -- Verificação simples e direta de Admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'adm') THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- Busca direta com JOIN, ignorando RLS (pois é Security Definer)
    RETURN QUERY
    SELECT
        lh.id,
        lh.user_id,
        lh.points,
        lh.description,
        lh.created_at,
        lh.operation_type,
        p.first_name,
        p.last_name
    FROM loyalty_history lh
    LEFT JOIN profiles p ON lh.user_id = p.id
    ORDER BY lh.created_at DESC
    LIMIT 100;
END;
$function$;
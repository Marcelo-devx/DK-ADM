CREATE OR REPLACE FUNCTION public.get_all_loyalty_history_admin()
 RETURNS TABLE(id bigint, user_id uuid, points integer, description text, created_at timestamp with time zone, operation_type text, profile_first_name text, profile_last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER -- Isso força a função a rodar como Super Admin, ignorando RLS
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
BEGIN
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
    LIMIT 500;
END;
$function$;
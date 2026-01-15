DROP FUNCTION IF EXISTS public.get_customers_at_risk();

CREATE OR REPLACE FUNCTION public.get_customers_at_risk()
 RETURNS TABLE(user_id uuid, customer_name text, email text, days_since_last_order integer, total_orders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))::text as customer_name,
        u.email::text,
        CASE 
            WHEN MAX(o.created_at) IS NOT NULL THEN (CURRENT_DATE - MAX(o.created_at)::date)::integer
            ELSE (CURRENT_DATE - u.created_at::date)::integer
        END as days_since_last_order,
        COUNT(o.id) as total_orders
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    LEFT JOIN public.orders o ON p.id = o.user_id AND o.status <> 'Cancelado'
    GROUP BY p.id, u.email, u.created_at, p.first_name, p.last_name
    HAVING 
        -- Caso 1: Tem pedidos, último foi há mais de 30 dias
        (MAX(o.created_at) IS NOT NULL AND (CURRENT_DATE - MAX(o.created_at)::date) > 30)
        OR
        -- Caso 2: Nunca comprou, mas cadastro tem mais de 30 dias (Inativo desde o início)
        (MAX(o.created_at) IS NULL AND (CURRENT_DATE - u.created_at::date) > 30)
    ORDER BY days_since_last_order DESC
    LIMIT 50;
END;
$function$;
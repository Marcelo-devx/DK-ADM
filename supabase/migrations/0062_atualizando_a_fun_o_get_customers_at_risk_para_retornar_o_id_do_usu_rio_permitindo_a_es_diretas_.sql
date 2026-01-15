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
        EXTRACT(DAY FROM (now() - MAX(o.created_at)))::INT as days_since_last_order,
        COUNT(o.id) as total_orders
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    JOIN public.orders o ON p.id = o.user_id
    GROUP BY p.id, u.email, p.first_name, p.last_name
    HAVING EXTRACT(DAY FROM (now() - MAX(o.created_at))) > 30 -- Mais de 30 dias sem comprar
    ORDER BY days_since_last_order DESC
    LIMIT 50;
END;
$function$;
-- Fix security issue: Add explicit permission checks to SECURITY DEFINER functions
-- and ensure others use SECURITY INVOKER to respect RLS.

-- 1. Secure get_customers_at_risk (Accessed auth.users, must be SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_customers_at_risk()
 RETURNS TABLE(user_id uuid, customer_name text, email text, days_since_last_order integer, total_orders bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
BEGIN
    -- Security Check: Allow service_role or Admin
    IF (COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role') AND 
       NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'adm') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

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
        (MAX(o.created_at) IS NOT NULL AND (CURRENT_DATE - MAX(o.created_at)::date) > 30)
        OR
        (MAX(o.created_at) IS NULL AND (CURRENT_DATE - u.created_at::date) > 30)
    ORDER BY days_since_last_order DESC
    LIMIT 50;
END;
$function$;

-- 2. Secure get_all_loyalty_history_admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_all_loyalty_history_admin()
 RETURNS TABLE(id bigint, user_id uuid, points integer, description text, created_at timestamp with time zone, operation_type text, profile_first_name text, profile_last_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
BEGIN
    -- Security Check: Allow service_role or Admin
    IF (COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role') AND 
       NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'adm') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

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

-- 3. Secure get_user_id_by_email (Accessed auth.users, must be SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  uid uuid;
BEGIN
  -- Security Check: Allow service_role or Admin
  IF (COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role') AND 
     NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'adm') THEN
      RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id INTO uid FROM auth.users WHERE email = user_email;
  RETURN uid;
END;
$function$;

-- 4. Enforce SECURITY INVOKER for get_all_user_coupons_with_usage to use RLS policies
ALTER FUNCTION public.get_all_user_coupons_with_usage() SECURITY INVOKER;
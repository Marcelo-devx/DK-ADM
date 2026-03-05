-- Verificar funções que usam comparações de data/hora específicas
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.prolang = 14 -- plpgsql
AND (
    pg_get_functiondef(p.oid) LIKE '%EXTRACT(DAY FROM NOW())%' OR
    pg_get_functiondef(p.oid) LIKE '%EXTRACT(MONTH FROM NOW())%' OR
    pg_get_functiondef(p.oid) LIKE '%EXTRACT(DOW FROM NOW())%' OR
    pg_get_functiondef(p.oid) LIKE '%CURRENT_DATE%' OR
    pg_get_functiondef(p.oid) LIKE '%NOW()%'
)
ORDER BY p.proname;
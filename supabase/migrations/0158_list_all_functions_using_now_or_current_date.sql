-- Buscar todas as funções que usam NOW() ou CURRENT_DATE
SELECT 
    routine_name,
    LEFT(routine_definition, 200) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
AND (
    routine_definition ILIKE '%NOW()%' OR
    routine_definition ILIKE '%CURRENT_DATE%'
)
ORDER BY routine_name;
-- Verificar a função de aniversário
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name ILIKE '%anniversary%'
OR routine_name ILIKE '%birthday%';
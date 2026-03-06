-- Listar todas as funções que fazem referência a loyalty_tier_id ou loyalty_tiers
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND (
    prosrc LIKE '%loyalty_tier_id%' 
    OR prosrc LIKE '%loyalty_tiers%'
  );
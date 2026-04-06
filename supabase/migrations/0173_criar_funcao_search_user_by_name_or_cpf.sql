-- Criar função RPC para buscar clientes por nome ou CPF
-- Corrige o problema de busca de clientes no painel administrativo

CREATE OR REPLACE FUNCTION public.search_user_by_name_or_cpf(p_search_term text)
RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, cpf_cnpj text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.cpf_cnpj,
    p.phone
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE 
    -- Busca por nome completo
    CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) ILIKE '%' || p_search_term || '%'
    -- Busca por CPF (limpando formatação)
    OR REPLACE(p.cpf_cnpj, '.', '') ILIKE '%' || REPLACE(p_search_term, '.', '') || '%'
    OR REPLACE(p.cpf_cnpj, '-', '') ILIKE '%' || REPLACE(p_search_term, '-', '') || '%'
    -- Busca por primeiro nome ou último nome
    OR p.first_name ILIKE '%' || p_search_term || '%'
    OR p.last_name ILIKE '%' || p_search_term || '%';
END;
$function$;

-- Conceder permissão de execução para usuários autenticados e anônimos
GRANT EXECUTE ON FUNCTION public.search_user_by_name_or_cpf(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_user_by_name_or_cpf(text) TO anon;
-- Criar função helper para converter UTC para horário de Brasília
CREATE OR REPLACE FUNCTION public.brasilia_now()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NOW() AT TIME ZONE 'America/Sao_Paulo';
$$;

-- Criar função helper para obter a data atual em Brasília
CREATE OR REPLACE FUNCTION public.brasilia_date()
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo';
$$;

-- Testar as funções helper
SELECT 
    public.brasilia_now() as agora_brasilia,
    public.brasilia_date() as hoje_brasilia,
    NOW() as agora_utc,
    CURRENT_DATE as hoje_utc;
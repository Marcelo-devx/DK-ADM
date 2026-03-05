-- Verificar se tudo está configurado corretamente
SELECT 
    'Fuso horário helper' as teste,
    public.brasilia_now()::text as resultado
UNION ALL
SELECT 
    'Data helper' as teste,
    public.brasilia_date()::text as resultado
UNION ALL
SELECT 
    'Job de automação' as teste,
    schedule as resultado
FROM cron.job 
WHERE jobname = 'update-separated-orders-to-dispatched'
ORDER BY teste;
-- Verificar estado final da automação
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job 
WHERE jobname = 'update-separated-orders-to-dispatched';
-- Verificar logs de execução do job (se houver)
SELECT * 
FROM cron.job_run_details 
WHERE jobid = 5
ORDER BY start_time DESC
LIMIT 5;
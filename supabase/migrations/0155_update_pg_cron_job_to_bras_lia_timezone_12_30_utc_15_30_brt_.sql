-- Remover o job atual
SELECT cron.unschedule('update-separated-orders-to-dispatched');

-- Recriar o job com horário de Brasília (12:30 UTC = 15:30 BRT)
SELECT cron.schedule(
    'update-separated-orders-to-dispatched',
    '30 12 * * *',
    $$SELECT public.auto_update_orders_to_dispatched();$$
);

-- Verificar o novo agendamento
SELECT jobid, jobname, schedule, active, command
FROM cron.job 
WHERE jobname = 'update-separated-orders-to-dispatched';
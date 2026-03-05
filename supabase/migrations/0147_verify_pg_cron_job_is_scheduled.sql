-- Verificar se o job está agendado
SELECT * FROM cron.job WHERE jobname = 'update-separated-orders-to-dispatched';
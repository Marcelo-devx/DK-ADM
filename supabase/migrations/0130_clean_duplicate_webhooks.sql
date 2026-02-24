-- 1. Remove duplicatas mantendo apenas o ID mais recente
DELETE FROM webhook_configs a USING (
    SELECT max(id) as id, trigger_event
    FROM webhook_configs 
    GROUP BY trigger_event HAVING COUNT(*) > 1
) b
WHERE a.trigger_event = b.trigger_event 
AND a.id <> b.id;

-- 2. Adiciona restrição para impedir duplicidade futura
-- Isso garante que só possa haver UMA linha ativa para 'order_created' por exemplo
ALTER TABLE webhook_configs DROP CONSTRAINT IF EXISTS webhook_configs_trigger_event_key;
DROP INDEX IF EXISTS webhook_configs_trigger_event_idx;
CREATE UNIQUE INDEX webhook_configs_trigger_event_idx ON webhook_configs (trigger_event) WHERE is_active = true;
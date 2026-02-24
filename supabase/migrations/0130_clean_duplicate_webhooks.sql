-- 1. Remove duplicatas mantendo apenas o registro mais recente
DELETE FROM webhook_configs a USING (
      SELECT min(ctid) as ctid, trigger_event, target_url
      FROM webhook_configs 
      GROUP BY trigger_event, target_url HAVING COUNT(*) > 1
      ) b
      WHERE a.trigger_event = b.trigger_event 
      AND a.target_url = b.target_url 
      AND a.ctid <> b.ctid;

-- 2. Adiciona restrição única para evitar futuras duplicatas
ALTER TABLE webhook_configs DROP CONSTRAINT IF EXISTS unique_event_target;
ALTER TABLE webhook_configs ADD CONSTRAINT unique_event_target UNIQUE (trigger_event, target_url);
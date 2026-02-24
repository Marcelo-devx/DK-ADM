-- SOLUÇÃO NUCLEAR PARA DUPLICIDADE DE GATILHOS

-- 1. Remove TODOS os triggers da tabela 'orders' dinamicamente
DO $$ 
DECLARE 
    trg record;
BEGIN 
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'orders' 
        AND event_object_schema = 'public'
    LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg.trigger_name) || ' ON public.orders CASCADE';
    END LOOP; 
END $$;

-- 2. Limpa configurações de webhook duplicadas (deixa apenas a mais recente para cada evento)
DELETE FROM webhook_configs a USING (
    SELECT max(id) as id, trigger_event
    FROM webhook_configs 
    GROUP BY trigger_event HAVING COUNT(*) > 1
) b
WHERE a.trigger_event = b.trigger_event 
AND a.id <> b.id;

-- 3. Recria o ÚNICO gatilho oficial (Apenas INSERT)
CREATE TRIGGER tr_official_order_webhook_v2
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();
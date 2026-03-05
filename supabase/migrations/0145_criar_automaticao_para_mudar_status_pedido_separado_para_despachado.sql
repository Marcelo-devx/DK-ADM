-- Ativar extensão pg_cron (se não estiver ativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função de automação
CREATE OR REPLACE FUNCTION public.auto_update_orders_to_dispatched()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    order_record RECORD;
    cutoff_time TIMESTAMP WITH TIME ZONE;
    order_day INTEGER;
BEGIN
    -- Itera sobre todos os pedidos "Pedido separado"
    FOR order_record IN 
        SELECT id, created_at 
        FROM public.orders 
        WHERE delivery_status = 'Pedido separado'
    LOOP
        order_day := EXTRACT(DOW FROM order_record.created_at);
        
        -- Calcula o horário de corte
        cutoff_time := date_trunc('day', order_record.created_at);
        
        IF order_day = 0 THEN
            -- Domingo: Não aplica regra (vai para próxima rota)
            CONTINUE;
        ELSIF order_day = 6 THEN
            -- Sábado: Corte às 12:30
            cutoff_time := cutoff_time + INTERVAL '12 hours 30 minutes';
        ELSE
            -- Segunda a Sexta: Corte às 14:00
            cutoff_time := cutoff_time + INTERVAL '14 hours';
        END IF;
        
        -- Se o pedido foi feito até o horário de corte, atualiza
        IF order_record.created_at <= cutoff_time THEN
            UPDATE public.orders 
            SET delivery_status = 'Despachado',
                delivery_info = COALESCE(delivery_info, '') || ' [Atualizado automaticamente às 15:30]'
            WHERE id = order_record.id;
            
            v_updated_count := v_updated_count + 1;
        END IF;
    END LOOP;
    
    -- Registrar execução no log
    RAISE NOTICE 'auto_update_orders_to_dispatched: % pedidos atualizados', v_updated_count;
    
    RETURN v_updated_count;
END;
$$;

-- Configurar o job para rodar todos os dias às 15:30
-- Se o job já existe, remover primeiro
SELECT cron.unschedule('update-separated-orders-to-dispatched');

-- Criar o job
SELECT cron.schedule(
    'update-separated-orders-to-dispatched',
    '0 15:30 * * *',
    $$SELECT public.auto_update_orders_to_dispatched();$$
);

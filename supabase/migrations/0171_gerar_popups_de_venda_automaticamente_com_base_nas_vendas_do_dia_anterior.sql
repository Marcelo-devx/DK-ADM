-- Ativar extensão pg_cron (se necessário)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função principal para gerar popups a partir dos pedidos do dia anterior
CREATE OR REPLACE FUNCTION public.generate_sales_popups_from_yesterday()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_count INTEGER := 0;
    v_yesterday_start TIMESTAMP WITH TIME ZONE;
    v_yesterday_end TIMESTAMP WITH TIME ZONE;
    v_order RECORD;
    v_random_item RECORD;
    v_customer_name TEXT;
    v_time_ago TEXT;
    v_hours_ago INTEGER;
BEGIN
    -- Calcular início e fim do dia anterior em BRT
    v_yesterday_start := ((NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE - INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo';
    v_yesterday_end := ((NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE) AT TIME ZONE 'America/Sao_Paulo';
    
    -- Iterar sobre pedidos do dia anterior
    FOR v_order IN 
        SELECT DISTINCT o.id, o.user_id, o.created_at, p.first_name
        FROM public.orders o
        INNER JOIN public.profiles p ON p.id = o.user_id
        WHERE o.created_at >= v_yesterday_start
          AND o.created_at < v_yesterday_end
          AND o.status IN ('Pago', 'Finalizada')
          AND o.user_id IS NOT NULL
          AND NOT EXISTS (
              -- Evitar duplicatas: verificar se já existe popup para este pedido
              SELECT 1 FROM public.sales_popups sp 
              WHERE sp.customer_name = COALESCE(SPLIT_PART(p.first_name, ' ', 1), 'Cliente')
              AND sp.product_name IN (
                  SELECT oi.name_at_purchase FROM public.order_items oi 
                  WHERE oi.order_id = o.id
              )
              AND EXTRACT(YEAR FROM sp.created_at) = EXTRACT(YEAR FROM NOW())
              AND EXTRACT(MONTH FROM sp.created_at) = EXTRACT(MONTH FROM NOW())
              AND EXTRACT(DAY FROM sp.created_at) = EXTRACT(DAY FROM NOW())
          )
    LOOP
        -- Pegar primeiro nome (com fallback)
        v_customer_name := COALESCE(
            SPLIT_PART(v_order.first_name, ' ', 1),
            'Cliente'
        );
        
        -- Selecionar 1 item aleatório do pedido
        SELECT * INTO v_random_item
        FROM public.order_items
        WHERE order_id = v_order.id
        ORDER BY RANDOM()
        LIMIT 1;
        
        -- Se encontrou item, criar popup
        IF FOUND THEN
            -- Calcular tempo relativo
            v_hours_ago := EXTRACT(HOUR FROM (NOW() - v_order.created_at));
            
            IF v_hours_ago < 24 THEN
                v_time_ago := 'Há ' || v_hours_ago || ' horas';
            ELSIF v_hours_ago < 48 THEN
                v_time_ago := 'Ontem';
            ELSE
                v_time_ago := 'Há ' || (v_hours_ago / 24) || ' dias';
            END IF;
            
            -- Inserir popup
            INSERT INTO public.sales_popups (
                customer_name,
                product_id,
                product_name,
                product_image_url,
                time_ago,
                is_active
            ) VALUES (
                v_customer_name,
                v_random_item.item_id::bigint,
                v_random_item.name_at_purchase,
                v_random_item.image_url_at_purchase,
                v_time_ago,
                true
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'generate_sales_popups_from_yesterday: % popups criados', v_count;
    RETURN v_count;
END;
$$;

-- Configurar job para rodar diariamente às 11:00 UTC (08:00 BRT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-sales-popups') THEN
        PERFORM cron.unschedule('generate-daily-sales-popups');
    END IF;
END $$;

SELECT cron.schedule(
    'generate-daily-sales-popups',
    '0 11 * * *',  -- 11:00 UTC = 08:00 BRT
    $$SELECT public.generate_sales_popups_from_yesterday();$$
);

-- Verificar o agendamento
SELECT jobid, jobname, schedule, active, command
FROM cron.job 
WHERE jobname = 'generate-daily-sales-popups';

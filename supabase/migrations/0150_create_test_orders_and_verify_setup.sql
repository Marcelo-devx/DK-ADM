-- Criar pedidos de teste para validar a automação
-- Primeiro, vamos criar um usuário de teste se não existir
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Buscar ou criar um usuário de teste
    -- Assumindo que já existe um usuário para teste
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Nenhum usuário encontrado para criar pedidos de teste';
    ELSE
        -- Criar pedido A: "Pedido separado", criado antes do horário de corte (segunda-feira 10:00)
        INSERT INTO orders (id, user_id, total_price, shipping_cost, status, shipping_address, delivery_status, created_at)
        VALUES (
            9999001,
            v_user_id,
            100.00,
            10.00,
            'Pago',
            '{"street": "Rua Teste", "number": "123", "neighborhood": "Centro", "city": "Curitiba", "zip_code": "80000-000"}',
            'Pedido separado',
            (DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day') + INTERVAL '10 hours')::timestamp with time zone
        );
        
        -- Criar pedido B: "Pedido separado", criado no horário de corte (segunda-feira 14:00)
        INSERT INTO orders (id, user_id, total_price, shipping_cost, status, shipping_address, delivery_status, created_at)
        VALUES (
            9999002,
            v_user_id,
            150.00,
            10.00,
            'Pago',
            '{"street": "Rua Teste", "number": "456", "neighborhood": "Centro", "city": "Curitiba", "zip_code": "80000-000"}',
            'Pedido separado',
            (DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day') + INTERVAL '14 hours')::timestamp with time zone
        );
        
        -- Criar pedido C: "Pedido separado", criado após o horário de corte (segunda-feira 16:00)
        INSERT INTO orders (id, user_id, total_price, shipping_cost, status, shipping_address, delivery_status, created_at)
        VALUES (
            9999003,
            v_user_id,
            200.00,
            10.00,
            'Pago',
            '{"street": "Rua Teste", "number": "789", "neighborhood": "Centro", "city": "Curitiba", "zip_code": "80000-000"}',
            'Pedido separado',
            (DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day') + INTERVAL '16 hours')::timestamp with time zone
        );
        
        -- Criar pedido D: "Pedido separado", criado domingo (não deve ser atualizado)
        INSERT INTO orders (id, user_id, total_price, shipping_cost, status, shipping_address, delivery_status, created_at)
        VALUES (
            9999004,
            v_user_id,
            250.00,
            10.00,
            'Pago',
            '{"street": "Rua Teste", "number": "321", "neighborhood": "Centro", "city": "Curitiba", "zip_code": "80000-000"}',
            'Pedido separado',
            (DATE_TRUNC('day', CURRENT_DATE) - EXTRACT(DOW FROM CURRENT_DATE)::integer * INTERVAL '1 day')::timestamp with time zone + INTERVAL '10 hours'
        );
        
        RAISE NOTICE 'Pedidos de teste criados com sucesso';
    END IF;
END $$;

-- Verificar os pedidos de teste criados
SELECT 
    id,
    delivery_status,
    created_at,
    CASE 
        WHEN EXTRACT(DOW FROM created_at) = 0 THEN 'Domingo (NÃO deve atualizar)'
        WHEN EXTRACT(DOW FROM created_at) = 6 THEN 'Sábado (Corte 12:30)'
        ELSE 'Dia útil (Corte 14:00)'
    END as expected_behavior
FROM orders 
WHERE id IN (9999001, 9999002, 9999003, 9999004)
ORDER BY id;
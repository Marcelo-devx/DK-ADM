-- Verificar quais pedidos foram atualizados
SELECT 
    id,
    delivery_status,
    delivery_info,
    created_at,
    CASE 
        WHEN delivery_status = 'Despachado' THEN '✓ ATUALIZADO'
        ELSE '✗ NÃO ATUALIZADO'
    END as result
FROM orders 
WHERE id IN (9999001, 9999002, 9999003, 9999004)
ORDER BY id;
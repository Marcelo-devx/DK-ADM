-- 1. Função para encontrar produtos comprados juntos (Cross-sell)
CREATE OR REPLACE FUNCTION get_product_pair_frequency()
RETURNS TABLE(product_a TEXT, product_b TEXT, frequency BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p1.name_at_purchase as product_a, 
        p2.name_at_purchase as product_b, 
        COUNT(*) as frequency
    FROM public.order_items p1
    JOIN public.order_items p2 ON p1.order_id = p2.order_id AND p1.item_id < p2.item_id
    GROUP BY p1.name_at_purchase, p2.name_at_purchase
    ORDER BY frequency DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para identificar clientes em risco (Churn)
CREATE OR REPLACE FUNCTION get_customers_at_risk()
RETURNS TABLE(customer_name TEXT, email TEXT, days_since_last_order INT, total_orders BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (p.first_name || ' ' || p.last_name) as customer_name,
        u.email,
        EXTRACT(DAY FROM (now() - MAX(o.created_at)))::INT as days_since_last_order,
        COUNT(o.id) as total_orders
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    JOIN public.orders o ON p.id = o.user_id
    GROUP BY p.id, u.email, p.first_name, p.last_name
    HAVING EXTRACT(DAY FROM (now() - MAX(o.created_at))) > 30 -- Mais de 30 dias sumido
    ORDER BY days_since_last_order DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
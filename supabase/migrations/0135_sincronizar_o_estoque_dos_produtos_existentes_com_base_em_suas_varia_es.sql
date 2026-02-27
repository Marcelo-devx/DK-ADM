-- Sincroniza o estoque de todos os produtos que possuem variações
UPDATE products p
SET stock_quantity = (
    SELECT COALESCE(SUM(pv.stock_quantity), 0)
    FROM product_variants pv
    WHERE pv.product_id = p.id
)
WHERE EXISTS (
    SELECT 1
    FROM product_variants pv
    WHERE pv.product_id = p.id
);
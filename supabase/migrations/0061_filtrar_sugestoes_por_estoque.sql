CREATE OR REPLACE FUNCTION public.get_product_pair_frequency()
 RETURNS TABLE(product_a text, product_b text, frequency bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pr1.name as product_a, 
        pr2.name as product_b, 
        COUNT(*) as frequency
    FROM public.order_items p1
    JOIN public.order_items p2 ON p1.order_id = p2.order_id AND p1.item_id < p2.item_id
    JOIN public.products pr1 ON p1.item_id = pr1.id
    JOIN public.products pr2 ON p2.item_id = pr2.id
    WHERE 
        p1.item_type = 'product' AND p2.item_type = 'product'
        AND pr1.stock_quantity > 0 
        AND pr2.stock_quantity > 0
    GROUP BY pr1.name, pr2.name
    ORDER BY frequency DESC
    LIMIT 5;
END;
$function$;
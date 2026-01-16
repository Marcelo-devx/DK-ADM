CREATE OR REPLACE FUNCTION public.get_product_pair_frequency()
 RETURNS TABLE(product_a text, product_a_id bigint, product_b text, product_b_id bigint, frequency bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pr1.name::text as product_a, 
        pr1.id as product_a_id,
        pr2.name::text as product_b, 
        pr2.id as product_b_id,
        COUNT(*) as frequency
    FROM public.order_items p1
    JOIN public.order_items p2 ON p1.order_id = p2.order_id AND p1.item_id < p2.item_id
    JOIN public.products pr1 ON p1.item_id = pr1.id
    JOIN public.products pr2 ON p2.item_id = pr2.id
    WHERE 
        p1.item_type = 'product' AND p2.item_type = 'product'
        AND pr1.stock_quantity > 0 
        AND pr2.stock_quantity > 0
        AND pr1.is_visible = true
        AND pr2.is_visible = true
    GROUP BY pr1.name, pr1.id, pr2.name, pr2.id
    ORDER BY frequency DESC
    LIMIT 5;
END;
$function$;
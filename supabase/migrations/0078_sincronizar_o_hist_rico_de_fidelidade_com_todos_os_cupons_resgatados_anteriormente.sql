INSERT INTO public.loyalty_history (user_id, points, description, operation_type, created_at)
SELECT 
    uc.user_id, 
    -(c.points_cost), 
    'Resgate de Cupom: ' || c.name, 
    'redeem',
    uc.created_at
FROM public.user_coupons uc
JOIN public.coupons c ON uc.coupon_id = c.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.loyalty_history lh 
    WHERE lh.user_id = uc.user_id 
    AND lh.operation_type = 'redeem' 
    AND lh.created_at = uc.created_at
);
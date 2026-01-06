-- Drop functions that depend on carts and cart_items tables
DROP FUNCTION IF EXISTS public.create_order_from_cart(numeric, jsonb);
DROP FUNCTION IF EXISTS public.add_promotion_to_cart_and_update_stock(uuid, bigint, integer);
DROP FUNCTION IF EXISTS public.add_to_cart_and_update_stock(uuid, bigint, integer);
DROP FUNCTION IF EXISTS public.restock_expired_cart_items();

-- Drop the tables. The CASCADE option will handle dependent objects like policies.
DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
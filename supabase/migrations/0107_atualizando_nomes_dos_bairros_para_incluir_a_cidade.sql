UPDATE public.shipping_rates
SET location_name = location_name || ' - Curitiba'
WHERE location_name NOT LIKE '% - Curitiba';
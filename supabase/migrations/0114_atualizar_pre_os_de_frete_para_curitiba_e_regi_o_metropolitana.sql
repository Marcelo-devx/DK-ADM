-- Atualiza Curitiba para 12.99
UPDATE public.shipping_rates
SET price = 12.99
WHERE city = 'Curitiba';

-- Atualiza todas as outras cidades para 15.99
UPDATE public.shipping_rates
SET price = 15.99
WHERE city <> 'Curitiba';
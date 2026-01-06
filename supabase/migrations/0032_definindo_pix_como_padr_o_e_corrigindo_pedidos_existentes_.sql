-- Define 'Pix' como o valor padrão para a coluna
ALTER TABLE public.orders ALTER COLUMN payment_method SET DEFAULT 'Pix';

-- Atualiza todos os pedidos que estão sem forma de pagamento para 'Pix'
UPDATE public.orders SET payment_method = 'Pix' WHERE payment_method IS NULL;
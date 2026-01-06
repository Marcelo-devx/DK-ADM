-- Altera o valor padrão da coluna para que novos usuários comecem com a restrição
ALTER TABLE public.profiles ALTER COLUMN force_pix_on_next_purchase SET DEFAULT true;
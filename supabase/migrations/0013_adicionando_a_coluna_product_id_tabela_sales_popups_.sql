ALTER TABLE public.sales_popups
ADD COLUMN product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL;

-- Opcional: Atualizar a política de segurança se necessário, mas a política atual já cobre o acesso de admin.
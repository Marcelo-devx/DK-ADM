-- Adiciona a coluna para controlar a aprovação, com 'false' como padrão
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Remove a política antiga que mostrava todas as avaliações
DROP POLICY IF EXISTS "Public can view all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;

-- Cria a nova política para mostrar apenas avaliações aprovadas
CREATE POLICY "Public can view approved reviews" ON public.reviews
  FOR SELECT USING (is_approved = true);
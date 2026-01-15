ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
-- Comentário: Valores sugeridos: 'Masculino', 'Feminino', 'Outro', 'Não Informado'
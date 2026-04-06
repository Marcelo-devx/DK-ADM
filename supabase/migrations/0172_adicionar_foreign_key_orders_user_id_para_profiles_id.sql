-- Adiciona foreign key constraint de orders.user_id para profiles.id
-- Isso permite que o Supabase faça joins entre as tabelas usando .select('*, profiles(...)')

-- PASSO 1: Primeiro vamos verificar se já existem registros órfãos e limpá-los
-- Registros órfãos são pedidos com user_id que não aponta para nenhum profile válido
-- Isso evita erros ao criar a constraint

-- Atualizar user_id para NULL em pedidos onde o profile não existe mais
UPDATE public.orders
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = orders.user_id
  );

-- PASSO 2: Remover qualquer constraint anterior se existir (para evitar conflitos)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'orders_user_id_fkey'
        AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_user_id_fkey;
    END IF;
END $$;

-- PASSO 3: Adicionar a foreign key constraint de forma segura
-- ON DELETE SET NULL: Se um profile for deletado, o user_id do pedido vira NULL (não deleta o pedido)
-- ON UPDATE CASCADE: Se o id do profile mudar (raro), atualiza automaticamente o user_id do pedido
ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL
ON UPDATE CASCADE
NOT VALID; -- NOT VALID faz com que a constraint não verifique dados existentes (mais rápido e seguro)

-- PASSO 4: Validar a constraint (verificar dados existentes de forma não bloqueante)
ALTER TABLE public.orders
VALIDATE CONSTRAINT orders_user_id_fkey;

-- Sucesso! A constraint está ativa e validada
-- Agora o Supabase pode fazer joins entre orders e profiles

-- 1. Função para sincronizar o preço do produto pai com o maior preço da variação
CREATE OR REPLACE FUNCTION public.sync_product_price_from_variants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    max_price NUMERIC;
    max_pix_price NUMERIC;
BEGIN
    -- Encontra o preço máximo entre todas as variações do produto pai
    SELECT 
        COALESCE(MAX(price), 0),
        COALESCE(MAX(pix_price), 0)
    INTO max_price, max_pix_price
    FROM public.product_variants
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);

    -- Atualiza o preço do produto pai
    -- Se não houver variações, max_price será 0. Nesse caso, não atualizamos para não zerar o preço do produto.
    -- O usuário deverá ajustar manualmente se remover todas as variações.
    IF max_price > 0 THEN
        UPDATE public.products
        SET 
            price = max_price,
            pix_price = max_pix_price
        WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    END IF;

    RETURN NULL; -- O resultado é ignorado para um gatilho AFTER
END;
$$;

-- 2. Gatilho para acionar a função em INSERT, UPDATE ou DELETE de variações
DROP TRIGGER IF EXISTS on_variant_change_sync_price ON public.product_variants;
CREATE TRIGGER on_variant_change_sync_price
AFTER INSERT OR UPDATE OF price, pix_price OR DELETE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_price_from_variants();

-- 3. Sincronização única para dados existentes
-- Atualiza o preço de todos os produtos que possuem variações para o maior valor entre elas.
UPDATE public.products p
SET 
    price = (
        SELECT MAX(pv.price)
        FROM public.product_variants pv
        WHERE pv.product_id = p.id
    ),
    pix_price = (
        SELECT MAX(pv.pix_price)
        FROM public.product_variants pv
        WHERE pv.product_id = p.id
    )
WHERE EXISTS (
    SELECT 1 FROM public.product_variants pv WHERE pv.product_id = p.id
);
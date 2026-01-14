-- Função que será executada ANTES de deletar uma promoção
CREATE OR REPLACE FUNCTION public.return_stock_on_promotion_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
    qty_to_return INTEGER;
BEGIN
    -- Se o kit não tem estoque, não precisa devolver nada
    IF OLD.stock_quantity <= 0 THEN
        RETURN OLD;
    END IF;

    -- Percorre todos os itens que compõem este kit
    FOR item IN SELECT * FROM public.promotion_items WHERE promotion_id = OLD.id
    LOOP
        -- Calcula o total a devolver: (Qtd por kit * Qtd de kits em estoque)
        qty_to_return := item.quantity * OLD.stock_quantity;

        IF qty_to_return > 0 THEN
            IF item.variant_id IS NOT NULL THEN
                -- Devolve para a Variação (Sabor/Tamanho específico)
                UPDATE public.product_variants
                SET stock_quantity = stock_quantity + qty_to_return
                WHERE id = item.variant_id;
            ELSE
                -- Devolve para o Produto Base
                UPDATE public.products
                SET stock_quantity = stock_quantity + qty_to_return
                WHERE id = item.product_id;
            END IF;
        END IF;
    END LOOP;

    RETURN OLD;
END;
$$;

-- Cria o gatilho na tabela de promoções
DROP TRIGGER IF EXISTS trigger_return_stock_on_promotion_delete ON public.promotions;

CREATE TRIGGER trigger_return_stock_on_promotion_delete
BEFORE DELETE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.return_stock_on_promotion_delete();
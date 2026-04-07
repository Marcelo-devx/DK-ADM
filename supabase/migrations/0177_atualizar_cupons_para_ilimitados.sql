-- Atualizar todos os cupons existentes para ilimitados (-1)
-- Isso permite que o setor de premiação possa atribuir cupons ilimitadamente
-- sem se preocupar com esgotamento de estoque

UPDATE coupons
SET stock_quantity = -1
WHERE stock_quantity != -1;

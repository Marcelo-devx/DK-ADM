UPDATE orders 
SET delivery_status = 'Aguardando Validação' 
WHERE 
  status = 'Pago' AND 
  delivery_status = 'Pendente' AND 
  (payment_method ILIKE '%pix%' OR payment_method IS NULL);
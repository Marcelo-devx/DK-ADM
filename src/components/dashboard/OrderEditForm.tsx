import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, X, Search } from "lucide-react";
import { showError } from "@/utils/toast";

interface OrderEditFormProps {
  order: any;
  onSave: (updates: any, reason: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function OrderEditForm({ order, onSave, onCancel, isLoading }: OrderEditFormProps) {
  const [updates, setUpdates] = useState<any>({});
  const [isCepLoading, setIsCepLoading] = useState(false);

  useEffect(() => {
    setUpdates({
      status: order.status,
      delivery_status: order.delivery_status,
      payment_method: order.payment_method || 'Pix',
      total_price: Number(order.total_price),
      shipping_cost: Number(order.shipping_cost),
      coupon_discount: Number(order.coupon_discount) || 0,
      donation_amount: Number(order.donation_amount) || 0,
      shipping_address: order.shipping_address,
      delivery_info: order.delivery_info || '',
    });
  }, [order]);

  const handleSubmit = async () => {
    await onSave(updates, "");
  };

  const handleChange = (field: string, value: any) => {
    setUpdates(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setUpdates(prev => ({
      ...prev,
      shipping_address: {
        ...prev.shipping_address,
        [field]: value
      }
    }));
  };

  const handleCepLookup = async () => {
    const cep = (updates.shipping_address?.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      showError('CEP inválido. Digite 8 dígitos.');
      return;
    }
    setIsCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        showError('CEP não encontrado.');
        return;
      }
      setUpdates((prev: any) => ({
        ...prev,
        shipping_address: {
          ...prev.shipping_address,
          street: data.logradouro || prev.shipping_address?.street || '',
          neighborhood: data.bairro || prev.shipping_address?.neighborhood || '',
          city: data.localidade || prev.shipping_address?.city || '',
          state: data.uf || prev.shipping_address?.state || '',
          cep: data.cep || prev.shipping_address?.cep || '',
        },
      }));
    } catch {
      showError('Erro ao consultar CEP.');
    } finally {
      setIsCepLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const hasChanges = JSON.stringify(updates) !== JSON.stringify({
    status: order.status,
    delivery_status: order.delivery_status,
    payment_method: order.payment_method || 'Pix',
    total_price: Number(order.total_price),
    shipping_cost: Number(order.shipping_cost),
    coupon_discount: Number(order.coupon_discount) || 0,
    donation_amount: Number(order.donation_amount) || 0,
    shipping_address: order.shipping_address,
    delivery_info: order.delivery_info || '',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Editar Pedido #{order.id}</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase">Status do Pedido</h4>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={updates.status} onValueChange={(v) => handleChange('status', v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_status">Status de Entrega</Label>
            <Select value={updates.delivery_status} onValueChange={(v) => handleChange('delivery_status', v)}>
              <SelectTrigger id="delivery_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aguardando Coleta">Aguardando Coleta</SelectItem>
                <SelectItem value="Embalado">Embalado</SelectItem>
                <SelectItem value="Despachado">Despachado</SelectItem>
                <SelectItem value="Entregue">Entregue</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Método de Pagamento</Label>
            <Select value={updates.payment_method} onValueChange={(v) => handleChange('payment_method', v)}>
              <SelectTrigger id="payment_method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pix">Pix</SelectItem>
                <SelectItem value="MercadoPago - Crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="MercadoPago - Débito">Cartão de Débito</SelectItem>
                <SelectItem value="MercadoPago - Boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Valores */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase">Valores</h4>
          
          <div className="space-y-2">
            <Label htmlFor="total_price">Preço Total</Label>
            <Input
              id="total_price"
              type="number"
              step="0.01"
              value={updates.total_price}
              onChange={(e) => handleChange('total_price', parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">{formatCurrency(updates.total_price)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipping_cost">Custo de Frete</Label>
            <Input
              id="shipping_cost"
              type="number"
              step="0.01"
              value={updates.shipping_cost}
              onChange={(e) => handleChange('shipping_cost', parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">{formatCurrency(updates.shipping_cost)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coupon_discount">Desconto Cupom</Label>
              <Input
                id="coupon_discount"
                type="number"
                step="0.01"
                value={updates.coupon_discount}
                onChange={(e) => handleChange('coupon_discount', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="donation_amount">Doação</Label>
              <Input
                id="donation_amount"
                type="number"
                step="0.01"
                value={updates.donation_amount}
                onChange={(e) => handleChange('donation_amount', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase">Endereço de Entrega</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="cep"
                value={updates.shipping_address?.cep || ''}
                onChange={(e) => handleAddressChange('cep', e.target.value)}
                placeholder="00000-000"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCepLookup}
                disabled={isCepLoading}
                title="Buscar endereço pelo CEP"
              >
                {isCepLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="street">Rua</Label>
            <Input
              id="street"
              value={updates.shipping_address?.street || ''}
              onChange={(e) => handleAddressChange('street', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={updates.shipping_address?.number || ''}
              onChange={(e) => handleAddressChange('number', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={updates.shipping_address?.complement || ''}
              onChange={(e) => handleAddressChange('complement', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={updates.shipping_address?.neighborhood || ''}
              onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={updates.shipping_address?.city || ''}
              onChange={(e) => handleAddressChange('city', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              value={updates.shipping_address?.state || ''}
              onChange={(e) => handleAddressChange('state', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground uppercase">Informações Adicionais</h4>
        <div className="space-y-2">
          <Label htmlFor="delivery_info">Info de Entrega / Observação</Label>
          <Textarea
            id="delivery_info"
            value={updates.delivery_info}
            onChange={(e) => handleChange('delivery_info', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!hasChanges || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
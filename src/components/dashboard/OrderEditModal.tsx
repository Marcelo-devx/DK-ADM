import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Loader2, Save, MapPin, DollarSign, Tag, Search } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";

interface OrderEditModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderEditModal({ order, isOpen, onClose }: OrderEditModalProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isCepLoading, setIsCepLoading] = useState(false);

  const [updates, setUpdates] = useState<any>({});

  useEffect(() => {
    if (order && isOpen) {
      setUpdates({
        status: order.status,
        delivery_status: order.delivery_status,
        payment_method: order.payment_method || "Pix",
        total_price: Number(order.total_price),
        shipping_cost: Number(order.shipping_cost),
        coupon_discount: Number(order.coupon_discount) || 0,
        donation_amount: Number(order.donation_amount) || 0,
        shipping_address: order.shipping_address
          ? { ...order.shipping_address }
          : {
              street: "",
              number: "",
              complement: "",
              neighborhood: "",
              city: "",
              state: "",
              cep: "",
            },
        delivery_info: order.delivery_info || "",
      });
    }
  }, [order, isOpen]);

  const handleChange = (field: string, value: any) => {
    setUpdates((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field: string, value: string) => {
    setUpdates((prev: any) => ({
      ...prev,
      shipping_address: {
        ...prev.shipping_address,
        [field]: value,
      },
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

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id);

      if (error) throw new Error(error.message);

      showSuccess(`Pedido #${order.id} atualizado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      onClose();
    } catch (err: any) {
      showError(err.message || "Erro ao atualizar pedido");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Pedido <span className="font-mono text-primary">#{order.id}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Status */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Tag className="h-4 w-4" /> Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs">Status do Pedido</Label>
                <Select value={updates.status} onValueChange={(v) => handleChange("status", v)}>
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

              <div className="space-y-1">
                <Label htmlFor="delivery_status" className="text-xs">Status de Entrega</Label>
                <Select value={updates.delivery_status} onValueChange={(v) => handleChange("delivery_status", v)}>
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

              <div className="space-y-1">
                <Label htmlFor="payment_method" className="text-xs">Pagamento</Label>
                <Select value={updates.payment_method} onValueChange={(v) => handleChange("payment_method", v)}>
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
          </div>

          {/* Valores */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-4 w-4" /> Valores
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="total_price" className="text-xs">Total</Label>
                <Input
                  id="total_price"
                  type="number"
                  step="0.01"
                  value={updates.total_price}
                  onChange={(e) => handleChange("total_price", parseFloat(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">{formatCurrency(updates.total_price || 0)}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="shipping_cost" className="text-xs">Frete</Label>
                <Input
                  id="shipping_cost"
                  type="number"
                  step="0.01"
                  value={updates.shipping_cost}
                  onChange={(e) => handleChange("shipping_cost", parseFloat(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">{formatCurrency(updates.shipping_cost || 0)}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="coupon_discount" className="text-xs">Desconto Cupom</Label>
                <Input
                  id="coupon_discount"
                  type="number"
                  step="0.01"
                  value={updates.coupon_discount}
                  onChange={(e) => handleChange("coupon_discount", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="donation_amount" className="text-xs">Doação</Label>
                <Input
                  id="donation_amount"
                  type="number"
                  step="0.01"
                  value={updates.donation_amount}
                  onChange={(e) => handleChange("donation_amount", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <MapPin className="h-4 w-4" /> Endereço de Entrega
              <span className="text-xs font-normal text-blue-600 normal-case tracking-normal ml-1">
                (editável independente do status)
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cep" className="text-xs">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    value={updates.shipping_address?.cep || ""}
                    onChange={(e) => handleAddressChange("cep", e.target.value)}
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
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="street" className="text-xs">Rua / Logradouro</Label>
                <Input
                  id="street"
                  value={updates.shipping_address?.street || ""}
                  onChange={(e) => handleAddressChange("street", e.target.value)}
                  placeholder="Rua das Flores"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="number" className="text-xs">Número</Label>
                <Input
                  id="number"
                  value={updates.shipping_address?.number || ""}
                  onChange={(e) => handleAddressChange("number", e.target.value)}
                  placeholder="123"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="complement" className="text-xs">Complemento</Label>
                <Input
                  id="complement"
                  value={updates.shipping_address?.complement || ""}
                  onChange={(e) => handleAddressChange("complement", e.target.value)}
                  placeholder="Apto 4"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="neighborhood" className="text-xs">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={updates.shipping_address?.neighborhood || ""}
                  onChange={(e) => handleAddressChange("neighborhood", e.target.value)}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city" className="text-xs">Cidade</Label>
                <Input
                  id="city"
                  value={updates.shipping_address?.city || ""}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state" className="text-xs">Estado</Label>
                <Input
                  id="state"
                  value={updates.shipping_address?.state || ""}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="delivery_info" className="text-xs font-semibold uppercase text-muted-foreground">
              Info de Entrega / Rastreamento
            </Label>
            <Textarea
              id="delivery_info"
              value={updates.delivery_info}
              onChange={(e) => handleChange("delivery_info", e.target.value)}
              rows={3}
              placeholder="Código de rastreio, observações..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

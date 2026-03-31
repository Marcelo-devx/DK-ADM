"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Trash2,
  Package,
  User,
  MapPin,
  DollarSign,
  Gift,
  Search,
  Check,
  Plus,
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
}

interface ProductVariant {
  id: string;
  product_id: number;
  flavor_id: number | null;
  volume_ml: number | null;
  sku: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  color: string | null;
  ohms: string | null;
  size: string | null;
}

interface Product {
  id: number;
  name: string;
  price: number;
  pix_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  sku: string | null;
  product_variants: ProductVariant[];
}

interface OrderItem {
  productId: number;
  variantId: string | null;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  stock: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrderModal = ({ isOpen, onClose }: CreateOrderModalProps) => {
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [searchingClient, setSearchingClient] = useState(false);
  const [clientNotFound, setClientNotFound] = useState(false);

  const [shippingAddress, setShippingAddress] = useState({
    street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [chargeFreight, setChargeFreight] = useState(true);
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);
  const [shippingCost, setShippingCost] = useState(0);
  const [manualTotal, setManualTotal] = useState<string>("");

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  const { data: shippingRates } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_rates").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: isOpen,
  });

  // Preenche endereço ao selecionar cliente
  useEffect(() => {
    if (selectedClient) {
      setShippingAddress({
        street: selectedClient.street || "",
        number: selectedClient.number || "",
        complement: selectedClient.complement || "",
        neighborhood: selectedClient.neighborhood || "",
        city: selectedClient.city || "",
        state: selectedClient.state || "",
        cep: selectedClient.cep || "",
      });
    }
  }, [selectedClient]);

  // Calcula frete ao mudar bairro/cidade
  useEffect(() => {
    if (!shippingAddress.neighborhood || !shippingAddress.city || !shippingRates) return;
    const neighborhood = shippingAddress.neighborhood.toLowerCase().trim();
    const city = shippingAddress.city.toLowerCase().trim();

    let match = (shippingRates as any[]).find(
      (r) => r.city.toLowerCase().trim() === city && r.neighborhood.toLowerCase().trim() === neighborhood
    );
    if (!match) {
      match = (shippingRates as any[]).find(
        (r) => r.city.toLowerCase().trim() === city &&
          (r.neighborhood.toLowerCase().includes(neighborhood) || neighborhood.includes(r.neighborhood.toLowerCase()))
      );
    }
    // Only set default shipping cost if user hasn't manually edited it (i.e., manualTotal empty and user hasn't typed into shippingCost)
    if (typeof match?.price !== 'undefined') {
      setShippingCost((prev) => prev === 0 ? Number(match.price) : prev);
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  const itemsTotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const finalShippingCost = chargeFreight ? Number(shippingCost || 0) : 0;
  const computedTotal = itemsTotal + finalShippingCost;
  const finalTotal = manualTotal && manualTotal.trim() !== "" ? Number(manualTotal) : computedTotal;

  // Busca cliente por email via RPC
  const findClientByEmail = async (email: string) => {
    if (!email) return;
    setSearchingClient(true);
    setClientNotFound(false);
    setClientConfirmed(false);
    setSelectedClient(null);
    try {
      const { data: uidData, error: uidError } = await supabase.rpc("get_user_id_by_email", { user_email: email });
      if (uidError) throw uidError;

      let userId: string | null = null;
      if (typeof uidData === "string") userId = uidData;
      else if (Array.isArray(uidData) && uidData.length > 0) {
        const first = uidData[0];
        userId = typeof first === "string" ? first : (Object.values(first)[0] as string);
      } else if (uidData && typeof uidData === "object") {
        userId = Object.values(uidData)[0] as string;
      }

      if (!userId) { setClientNotFound(true); return; }

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("*").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) { setClientNotFound(true); return; }

      setSelectedClient(profile as Client);
    } catch (err: any) {
      showError(err.message || "Erro ao buscar cliente");
      setClientNotFound(true);
    } finally {
      setSearchingClient(false);
    }
  };

  // Busca produtos por nome (server-side, sem Command)
  const searchProducts = async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return; }
    setSearchingProducts(true);
    try {
      const like = `%${term.trim()}%`;

      // Busca por nome do produto
      const { data: byName } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("name", like)
        //.eq("is_visible", true) // include invisibles so internal products can be used
        .limit(50);

      // Busca por SKU do produto
      const { data: bySku } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("sku", like)
        //.eq("is_visible", true)
        .limit(50);

      // Merge e dedupe
      const map = new Map<number, Product>();
      (byName || []).forEach((p: any) => map.set(p.id, p));
      (bySku || []).forEach((p: any) => map.set(p.id, p));

      setSearchResults(Array.from(map.values()));
    } catch (err: any) {
      showError("Erro ao buscar produtos");
    } finally {
      setSearchingProducts(false);
    }
  };

  // Debounce na busca de produtos
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(productSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleAddProduct = (product: Product, variant?: ProductVariant) => {
    const priceToUse = variant ? variant.price : product.price || 0;
    const stockAvailable = variant ? variant.stock_quantity : product.stock_quantity;

    if (stockAvailable === 0) { showError("Produto sem estoque!"); return; }

    const variantLabel = variant
      ? [variant.volume_ml ? `${variant.volume_ml}ml` : "", variant.color || "", variant.size ? `Tam ${variant.size}` : ""].filter(Boolean).join(" ").trim()
      : "";
    const nameToUse = variant ? `${product.name}${variantLabel ? ` - ${variantLabel}` : ""}` : product.name;

    const existingIndex = orderItems.findIndex(
      (item) => item.productId === product.id && item.variantId === (variant?.id || null)
    );

    if (existingIndex >= 0) {
      const newQty = orderItems[existingIndex].quantity + 1;
      if (newQty > stockAvailable) { showError(`Estoque insuficiente! Disponível: ${stockAvailable}`); return; }
      setOrderItems((prev) => {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      });
    } else {
      setOrderItems((prev) => [...prev, {
        productId: product.id,
        variantId: variant?.id || null,
        name: nameToUse,
        price: priceToUse,
        quantity: 1,
        imageUrl: product.image_url,
        stock: stockAvailable,
      }]);
    }
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const item = orderItems[index];
    const newQty = Math.max(1, Math.min(item.stock, isNaN(quantity) ? 1 : quantity));
    setOrderItems((prev) => { const u = [...prev]; u[index] = { ...u[index], quantity: newQty }; return u; });
  };

  const handleUpdatePrice = (index: number, price: number) => {
    const item = orderItems[index];
    const newPrice = Number(isNaN(price) ? item.price : price);
    setOrderItems((prev) => { const u = [...prev]; u[index] = { ...u[index], price: newPrice }; return u; });
  };

  const handleRemoveItem = (index: number) => setOrderItems((prev) => prev.filter((_, i) => i !== index));

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Selecione um cliente");
      if (!clientConfirmed) throw new Error("Confirme o cliente antes de criar o pedido");
      if (orderItems.length === 0) throw new Error("Adicione produtos ao pedido");

      // Recalcula totais na hora da execução para evitar closure stale
      const currentItemsTotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const currentShippingCost = chargeFreight ? shippingCost : 0;
      const currentTotal = manualTotal && manualTotal.trim() !== "" ? Number(manualTotal) : (currentItemsTotal + currentShippingCost);

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: selectedClient.id,
          total_price: currentTotal,
          shipping_cost: currentShippingCost,
          status: "Pago",
          payment_method: "Pix",
          delivery_status: "Aguardando Coleta",
          shipping_address: shippingAddress,
          benefits_used: generateLoyaltyPoints ? null : "no_loyalty_points",
        })
        .select().single();
      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from("order_items").insert(
        orderItems.map((item) => ({
          order_id: order.id,
          item_id: item.productId,
          item_type: "product",
          quantity: item.quantity,
          price_at_purchase: item.price,
          name_at_purchase: item.name,
          image_url_at_purchase: item.imageUrl,
        }))
      );
      if (itemsError) throw itemsError;

      for (const item of orderItems) {
        if (item.variantId) {
          await supabase.rpc("decrement_variant_stock", { variant_id: item.variantId, quantity: item.quantity });
        } else {
          await supabase.rpc("decrement_stock", { table_name: "products", row_id: item.productId, quantity: item.quantity });
        }
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pedido criado com sucesso!");
      handleClose();
    },
    onError: (error: any) => showError(`Erro ao criar pedido: ${error.message}`),
  });

  const handleClose = () => {
    setSelectedClient(null);
    setClientConfirmed(false);
    setEmailInput("");
    setClientNotFound(false);
    setOrderItems([]);
    setChargeFreight(true);
    setGenerateLoyaltyPoints(true);
    setShippingAddress({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "" });
    setProductSearch("");
    setSearchResults([]);
    setManualTotal("");
    onClose();
  };

  const fmt = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const fmtPhone = (phone: string | null) => {
    if (!phone) return "-";
    const c = phone.replace(/\D/g, "");
    return c.length === 11 ? `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}` : phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Criar Pedido Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* CLIENTE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <Label className="font-semibold">Cliente</Label>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Digite o email do cliente..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && findClientByEmail(emailInput.trim())}
              />
              <Button variant="outline" onClick={() => findClientByEmail(emailInput.trim())} disabled={searchingClient}>
                {searchingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {clientNotFound && (
              <p className="text-sm text-rose-600">Cliente não encontrado. Só é possível criar pedido para clientes cadastrados.</p>
            )}

            {selectedClient && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                <div>
                  <p className="font-medium">{selectedClient.first_name} {selectedClient.last_name}</p>
                  <p className="text-sm text-muted-foreground">{fmtPhone(selectedClient.phone)}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-green-600"
                    checked={clientConfirmed}
                    onChange={(e) => setClientConfirmed(e.target.checked)}
                  />
                  <span className="text-sm font-medium">Confirmar</span>
                  {clientConfirmed && <Check className="w-4 h-4 text-green-600" />}
                </label>
              </div>
            )}
          </div>

          {/* ENDEREÇO */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Label className="font-semibold">Endereço de Entrega</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Rua</Label>
                  <Input value={shippingAddress.street} onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })} placeholder="Rua" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Número</Label>
                  <Input value={shippingAddress.number} onChange={(e) => setShippingAddress({ ...shippingAddress, number: e.target.value })} placeholder="123" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Complemento</Label>
                  <Input value={shippingAddress.complement} onChange={(e) => setShippingAddress({ ...shippingAddress, complement: e.target.value })} placeholder="Apto..." />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bairro</Label>
                  <Input value={shippingAddress.neighborhood} onChange={(e) => setShippingAddress({ ...shippingAddress, neighborhood: e.target.value })} placeholder="Bairro" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cidade</Label>
                  <Input value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} placeholder="Cidade" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Input value={shippingAddress.state} onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })} placeholder="PR" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CEP</Label>
                  <Input value={shippingAddress.cep} onChange={(e) => setShippingAddress({ ...shippingAddress, cep: e.target.value })} placeholder="00000-000" />
                </div>
              </div>
            </div>
          )}

          {/* PRODUTOS */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <Label className="font-semibold">Produtos</Label>
              </div>

              {/* Campo de busca simples, sem Command */}
              <div className="relative">
                <div className="flex items-center border rounded-lg px-3 gap-2 bg-white">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    className="flex-1 py-2 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
                    placeholder="Digite o nome do produto para buscar..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {searchingProducts && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
                </div>

                {/* Resultados da busca */}
                {productSearch && (
                  <div className="border rounded-lg mt-1 bg-white shadow-lg max-h-72 overflow-y-auto">
                    {searchingProducts ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado para "{productSearch}"
                      </div>
                    ) : (
                      searchResults.map((product) => {
                        const activeVariants = (product.product_variants || []).filter((v) => v.is_active);
                        const hasVariants = activeVariants.length > 0;

                        if (!hasVariants) {
                          return (
                            <div key={product.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-0">
                              {product.image_url && (
                                <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded object-cover shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{product.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{fmt(product.price)}</span>
                                  {product.stock_quantity > 0
                                    ? <Badge variant="secondary" className="text-xs">{product.stock_quantity} em estoque</Badge>
                                    : <Badge variant="destructive" className="text-xs">Sem estoque</Badge>
                                  }
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={product.stock_quantity === 0}
                                onClick={() => handleAddProduct(product)}
                                className="shrink-0"
                              >
                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div key={product.id}>
                            <div className="px-3 py-2 bg-gray-50 border-b">
                              <p className="font-semibold text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{activeVariants.length} variação(ões)</p>
                            </div>
                            {activeVariants.map((variant) => {
                              const label = [
                                variant.volume_ml ? `${variant.volume_ml}ml` : "",
                                variant.color || "",
                                variant.size ? `Tam ${variant.size}` : "",
                                variant.ohms ? `${variant.ohms}Ω` : "",
                              ].filter(Boolean).join(" • ");

                              return (
                                <div key={variant.id} className="flex items-center gap-3 p-3 pl-6 hover:bg-gray-50 border-b last:border-0">
                                  {product.image_url && (
                                    <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded object-cover shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{label || `Variação ${variant.id.slice(0, 6)}`}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-muted-foreground">{fmt(variant.price)}</span>
                                      {variant.stock_quantity > 0
                                        ? <Badge variant="secondary" className="text-xs">{variant.stock_quantity} em estoque</Badge>
                                        : <Badge variant="destructive" className="text-xs">Sem estoque</Badge>
                                      }
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={variant.stock_quantity === 0}
                                    onClick={() => handleAddProduct(product, variant)}
                                    className="shrink-0"
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Itens adicionados */}
              {orderItems.length > 0 && (
                <div className="border rounded-lg divide-y">
                  <div className="px-4 py-2 bg-gray-50">
                    <Label className="text-sm font-semibold">Itens do Pedido ({orderItems.length})</Label>
                  </div>
                  {orderItems.map((item, index) => (
                    <div key={`${item.productId}-${item.variantId}-${index}`} className="flex items-center gap-3 p-3">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(item.price)} × {item.quantity} = {fmt(item.price * item.quantity)}</p>
                      </div>
                      <Input
                                type="number"
                                min="1"
                                max={item.stock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) handleUpdateQuantity(index, val);
                                }}
                                className="w-16 text-center"
                              />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) handleUpdatePrice(index, val);
                        }}
                        className="w-28 text-right"
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:bg-red-50 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FRETE E PONTOS */}
          {selectedClient && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <div>
                    <Label className="font-semibold text-sm">Cobrar Frete</Label>
                    <div className="flex items-center gap-2">
                      {chargeFreight ? (
                        <Input type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value || 0))} className="w-32 text-right" />
                      ) : (
                        <p className="text-xs text-muted-foreground">Grátis</p>
                      )}
                    </div>
                  </div>
                </div>
                <Switch checked={chargeFreight} onCheckedChange={setChargeFreight} />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <div>
                    <Label className="font-semibold text-sm">Gerar Pontos</Label>
                    <p className="text-xs text-muted-foreground">{generateLoyaltyPoints ? "Sim" : "Não"}</p>
                  </div>
                </div>
                <Switch checked={generateLoyaltyPoints} onCheckedChange={setGenerateLoyaltyPoints} />
              </div>
            </div>
          )}

          {/* RESUMO */}
          {selectedClient && orderItems.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <Label className="font-semibold">Resumo</Label>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Itens</span>
                <span>{fmt(itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete</span>
                <span>{fmt(finalShippingCost)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Total manual (opcional)</Label>
                <Input type="number" step="0.01" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} className="w-40 text-right" />
              </div>
              {!generateLoyaltyPoints && (
                <p className="text-xs text-amber-600">⚠️ Pontos de fidelidade não serão gerados</p>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{fmt(finalTotal)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => createOrderMutation.mutate()}
            disabled={!selectedClient || !clientConfirmed || orderItems.length === 0 || createOrderMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {createOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
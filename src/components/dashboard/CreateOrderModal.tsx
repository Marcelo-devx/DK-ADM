"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Check, AlertCircle, User, Trash2, Plus, Minus } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { sortVariantsBySpecification } from "@/utils/variantSort";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  cpf_cnpj: string | null;
}

interface ClientData {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  cpf_cnpj: string | null;
  phone: string | null;
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

  // Estados para busca de clientes
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [shippingAddress, setShippingAddress] = useState({
    street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [chargeFreight, setChargeFreight] = useState(true);
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);
  const [shippingCost, setShippingCost] = useState<string>("");
  const [manualTotal, setManualTotal] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: shippingRates } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_rates").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: isOpen,
  });

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSelectedClient(null);
      setSearchTerm("");
      setDebouncedSearch("");
      setShippingAddress({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "" });
      setOrderItems([]);
      setChargeFreight(true);
      setGenerateLoyaltyPoints(true);
      setShippingCost("");
      setManualTotal("");
      setPaymentMethod(null);
      setProductSearch("");
      setSearchResults([]);
      setExpandedProduct(null);
    }
  }, [isOpen]);

  // Debounce para busca de clientes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Busca clientes por e-mail, nome ou CPF diretamente na tabela profiles
  const { data: clientSearchResults, isLoading: searchingClients } = useQuery({
    queryKey: ["searchClients", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const term = debouncedSearch.trim();
      const queryText = `%${term}%`;
      const isCpfSearch = /^[0-9.\-\s]+$/.test(term);

      let query = supabase
        .from("profiles")
        .select("id, first_name, last_name, cpf_cnpj, email, phone")
        .order("first_name", { ascending: true })
        .limit(20);

      if (isCpfSearch) {
        query = query.or(`cpf_cnpj.ilike.${queryText}`);
      } else {
        query = query.or(`email.ilike.${queryText},first_name.ilike.${queryText},last_name.ilike.${queryText},cpf_cnpj.ilike.${queryText}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((client) => ({
        user_id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        cpf_cnpj: client.cpf_cnpj,
        phone: client.phone,
      })) as ClientData[];
    },
    enabled: debouncedSearch.length >= 2,
    refetchOnWindowFocus: false,
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
    if (typeof match?.price !== "undefined" && shippingCost === "") {
      setShippingCost(String(Number(match.price)));
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  const itemsTotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const finalShippingCost = chargeFreight ? Number(shippingCost || 0) : 0;
  const computedTotal = itemsTotal + finalShippingCost;
  const finalTotal = manualTotal && manualTotal.trim() !== "" ? Number(manualTotal) : computedTotal;

  // Selecionar cliente da lista de busca
  const handleSelectClient = async (clientData: ClientData) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", clientData.user_id)
        .maybeSingle();

      if (error) throw error;
      if (!profile) throw new Error("Perfil não encontrado");

      setSelectedClient(profile as Client);
      setSearchTerm("");
    } catch (err: any) {
      showError(err.message || "Erro ao carregar dados do cliente");
    }
  };

  // Busca produtos por nome ou SKU
  const searchProducts = async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return; }
    setSearchingProducts(true);
    try {
      const like = `%${term.trim()}%`;

      const { data: byName } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("name", like)
        .limit(50);

      const { data: bySku } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("sku", like)
        .limit(50);

      const map = new Map<number, Product>();
      (byName || []).forEach((p: any) => map.set(p.id, p));
      (bySku || []).forEach((p: any) => map.set(p.id, p));

      setSearchResults(Array.from(map.values()));
    } catch {
      showError("Erro ao buscar produtos");
    } finally {
      setSearchingProducts(false);
    }
  };

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
      ? [variant.volume_ml ? `${variant.volume_ml}ml` : "", variant.color || "", variant.ohms ? `${variant.ohms}Ω` : "", variant.size ? `Tam ${variant.size}` : ""].filter(Boolean).join(" ").trim()
      : "";
    const nameToUse = variant ? `${product.name}${variantLabel ? ` - ${variantLabel}` : ""}` : product.name;

    const existingIndex = orderItems.findIndex(
      (item) => item.productId === product.id && item.variantId === (variant?.id || null)
    );

    if (existingIndex >= 0) {
      setOrderItems((prev) => prev.map((item, idx) => idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setOrderItems((prev) => [...prev, { productId: product.id, variantId: variant?.id || null, name: nameToUse, price: priceToUse, quantity: 1, imageUrl: product.image_url, stock: stockAvailable }]);
    }
    setProductSearch("");
    setSearchResults([]);
    setExpandedProduct(null);
  };

  const handleRemoveProduct = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeQuantity = (index: number, delta: number) => {
    setOrderItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      return { ...item, quantity: newQty };
    }));
  };

  const handleCreateOrder = async () => {
    if (!selectedClient) { showError("Selecione um cliente"); return; }
    if (orderItems.length === 0) { showError("Adicione ao menos um produto"); return; }
    if (!paymentMethod) { showError("Selecione a forma de pagamento"); return; }

    setIsCreating(true);
    try {
      const payload = {
        user_id: selectedClient.id,
        items: orderItems.map((item) => ({
          item_id: item.productId,
          item_type: item.variantId ? "variant" : "product",
          quantity: item.quantity,
          price_at_purchase: item.price,
          name_at_purchase: item.name,
          variant_id: item.variantId,
        })),
        total_price: finalTotal,
        shipping_cost: chargeFreight ? Number(shippingCost || 0) : 0,
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        generate_loyalty_points: generateLoyaltyPoints,
      };

      const { error } = await supabase.rpc("create_order", payload as any);
      if (error) throw error;

      showSuccess("Pedido criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      onClose();
    } catch (err: any) {
      showError(err.message || "Erro ao criar pedido");
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Pedido Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── BUSCA DE CLIENTE ── */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">1. Cliente</Label>
            {!selectedClient ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por e-mail, nome ou CPF"
                    className="pl-10"
                  />
                </div>

                {searchingClients && debouncedSearch.length >= 2 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando clientes...
                  </div>
                )}

                {!searchingClients && debouncedSearch.length >= 2 && clientSearchResults && clientSearchResults.length > 0 && (
                  <div className="space-y-1 max-h-52 overflow-y-auto border rounded-md p-1">
                    {clientSearchResults.map((client) => (
                      <div
                        key={client.user_id}
                        className="flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div>
                          <p className="font-medium text-sm">{client.first_name} {client.last_name}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                          {client.cpf_cnpj && <p className="text-[10px] text-muted-foreground">CPF: {client.cpf_cnpj}</p>}
                        </div>
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {!searchingClients && debouncedSearch.length >= 2 && clientSearchResults && clientSearchResults.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    Nenhum cliente encontrado.
                  </div>
                )}
              </>
            ) : (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">{selectedClient.first_name} {selectedClient.last_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                      {selectedClient.phone && <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                    Trocar
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* ── BUSCA DE PRODUTOS ── */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">2. Produtos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto por nome ou SKU"
                className="pl-10"
              />
            </div>

            {searchingProducts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando produtos...
              </div>
            )}

            {!searchingProducts && searchResults.length > 0 && (
              <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                {searchResults.map((product) => {
                  const activeVariants = (product.product_variants || []).filter((v) => v.is_active);
                  const hasVariants = activeVariants.length > 0;
                  const isExpanded = expandedProduct === product.id;

                  return (
                    <div key={product.id}>
                      <div
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          if (!hasVariants) {
                            handleAddProduct(product);
                          } else {
                            setExpandedProduct(isExpanded ? null : product.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="h-8 w-8 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {hasVariants ? `${activeVariants.length} variações` : formatCurrency(product.price)}
                              {!hasVariants && ` · Estoque: ${product.stock_quantity}`}
                            </p>
                          </div>
                        </div>
                        {!hasVariants ? (
                          <Plus className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">{isExpanded ? "▲" : "▼"}</span>
                        )}
                      </div>

                      {hasVariants && isExpanded && (
                        <div className="bg-muted/30 divide-y">
                          {sortVariantsBySpecification(activeVariants).map((variant) => (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between px-6 py-1.5 hover:bg-muted cursor-pointer"
                              onClick={() => handleAddProduct(product, variant)}
                            >
                              <div>
                                <p className="text-xs font-medium">
                                  {[variant.volume_ml ? `${variant.volume_ml}ml` : "", variant.color || "", variant.ohms ? `${variant.ohms}Ω` : "", variant.size ? `Tam ${variant.size}` : ""].filter(Boolean).join(" ") || variant.sku || "Variação"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Estoque: {variant.stock_quantity}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">{formatCurrency(variant.price)}</span>
                                <Plus className="h-3 w-3 text-green-600" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lista de itens adicionados */}
            {orderItems.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-sm font-medium text-muted-foreground">Itens do pedido:</p>
                <div className="border rounded-md divide-y">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} cada</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleChangeQuantity(idx, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleChangeQuantity(idx, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold w-20 text-right shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleRemoveProduct(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── ENDEREÇO DE ENTREGA ── */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">3. Endereço de Entrega</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Rua / Logradouro</Label>
                <Input value={shippingAddress.street} onChange={(e) => setShippingAddress((p) => ({ ...p, street: e.target.value }))} placeholder="Rua das Flores" />
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={shippingAddress.number} onChange={(e) => setShippingAddress((p) => ({ ...p, number: e.target.value }))} placeholder="123" />
              </div>
              <div>
                <Label className="text-xs">Complemento</Label>
                <Input value={shippingAddress.complement} onChange={(e) => setShippingAddress((p) => ({ ...p, complement: e.target.value }))} placeholder="Apto 4" />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input value={shippingAddress.neighborhood} onChange={(e) => setShippingAddress((p) => ({ ...p, neighborhood: e.target.value }))} placeholder="Centro" />
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <Input value={shippingAddress.cep} onChange={(e) => setShippingAddress((p) => ({ ...p, cep: e.target.value }))} placeholder="00000-000" />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input value={shippingAddress.city} onChange={(e) => setShippingAddress((p) => ({ ...p, city: e.target.value }))} placeholder="São Paulo" />
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Input value={shippingAddress.state} onChange={(e) => setShippingAddress((p) => ({ ...p, state: e.target.value }))} placeholder="SP" maxLength={2} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── FRETE E OPÇÕES ── */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">4. Frete e Opções</Label>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cobrar frete</p>
                <p className="text-xs text-muted-foreground">Incluir custo de entrega no total</p>
              </div>
              <Switch checked={chargeFreight} onCheckedChange={setChargeFreight} />
            </div>

            {chargeFreight && (
              <div>
                <Label className="text-xs">Valor do frete (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="0,00"
                  className="w-40"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Gerar pontos de fidelidade</p>
                <p className="text-xs text-muted-foreground">Creditar pontos para o cliente</p>
              </div>
              <Switch checked={generateLoyaltyPoints} onCheckedChange={setGenerateLoyaltyPoints} />
            </div>
          </div>

          <Separator />

          {/* ── FORMA DE PAGAMENTO ── */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">5. Forma de Pagamento</Label>
            <RadioGroup value={paymentMethod || ""} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
              {[
                { value: "pix", label: "PIX" },
                { value: "credit_card", label: "Cartão de Crédito" },
                { value: "debit_card", label: "Cartão de Débito" },
                { value: "cash", label: "Dinheiro" },
                { value: "bank_transfer", label: "Transferência" },
                { value: "other", label: "Outro" },
              ].map((opt) => (
                <div key={opt.value} className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${paymentMethod === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setPaymentMethod(opt.value)}>
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="cursor-pointer text-sm">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* ── RESUMO DO PEDIDO ── */}
          <div className="space-y-2 bg-muted/30 rounded-lg p-4">
            <Label className="text-base font-semibold">Resumo</Label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{chargeFreight ? formatCurrency(Number(shippingCost || 0)) : "Grátis"}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(manualTotal && manualTotal.trim() !== "" ? Number(manualTotal) : computedTotal)}</span>
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Total manual (opcional — sobrescreve o calculado)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={manualTotal}
                onChange={(e) => setManualTotal(e.target.value)}
                placeholder={String(computedTotal.toFixed(2))}
                className="w-48 mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={handleCreateOrder} disabled={isCreating || !selectedClient || orderItems.length === 0 || !paymentMethod}>
            {isCreating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Check, AlertCircle, User, Trash2, Plus, Minus, QrCode, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { sortVariantsBySpecification } from "@/utils/variantSort";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  is_credit_card_enabled: boolean | null;
}

interface ClientSearchResult {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  cpf_cnpj: string | null;
  phone: string | null;
  is_credit_card_enabled: boolean | null;
}

interface ProductVariant {
  id: string;
  product_id: number;
  flavor_id: number | null;
  volume_ml: number | null;
  sku: string | null;
  price: number;
  pix_price: number | null;
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
  basePrice: number;       // preço cartão (price)
  pixPrice: number | null; // preço pix (pix_price)
  price: number;           // preço efetivo (calculado conforme pagamento)
  quantity: number;
  imageUrl: string | null;
  stock: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getVariantLabel = (variant: ProductVariant): string =>
  [
    variant.volume_ml ? `${variant.volume_ml}ml` : "",
    variant.color || "",
    variant.ohms ? `${variant.ohms}Ω` : "",
    variant.size ? `Tam ${variant.size}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || variant.sku || "Variação";

const getEffectivePrice = (
  basePrice: number,
  pixPrice: number | null,
  paymentMethod: string | null
): number => {
  if (paymentMethod === "pix" && pixPrice != null && pixPrice > 0) {
    return pixPrice;
  }
  return basePrice;
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export const CreateOrderModal = ({ isOpen, onClose }: CreateOrderModalProps) => {
  const queryClient = useQueryClient();

  // Cliente selecionado
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Endereço de entrega (editável)
  const [shippingAddress, setShippingAddress] = useState({
    street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "",
  });

  // Itens do pedido
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Frete
  const [chargeFreight, setChargeFreight] = useState(true);
  const [shippingCost, setShippingCost] = useState<string>("");

  // Pontos de fidelidade
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);

  // Forma de pagamento (apenas pix ou credit_card)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  // Busca de produtos
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  // Estado de criação
  const [isCreating, setIsCreating] = useState(false);

  // Ref para fechar dropdown de clientes ao clicar fora
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // ── Shipping rates ──────────────────────────────────────────────────────────
  const { data: shippingRates } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_rates").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: isOpen,
  });

  // ── Reset ao fechar ─────────────────────────────────────────────────────────
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
      setPaymentMethod(null);
      setProductSearch("");
      setSearchResults([]);
      setExpandedProduct(null);
    }
  }, [isOpen]);

  // ── Debounce busca de clientes ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Busca de clientes — todos, sem limite rígido, mínimo 1 char ─────────────
  const { data: clientSearchResults, isLoading: searchingClients } = useQuery({
    queryKey: ["searchClients", debouncedSearch],
    queryFn: async () => {
      const term = debouncedSearch.trim();

      // Se não digitou nada, retorna lista inicial (primeiros 80 clientes)
      if (!term) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, cpf_cnpj, email, phone, is_credit_card_enabled")
          .order("first_name", { ascending: true })
          .limit(80);
        if (error) throw error;
        return (data || []).map((c) => ({
          user_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          cpf_cnpj: c.cpf_cnpj,
          phone: c.phone,
          is_credit_card_enabled: c.is_credit_card_enabled,
        })) as ClientSearchResult[];
      }

      const queryText = `%${term}%`;
      const isCpfSearch = /^[0-9.\-\s]+$/.test(term);

      let query = supabase
        .from("profiles")
        .select("id, first_name, last_name, cpf_cnpj, email, phone, is_credit_card_enabled")
        .order("first_name", { ascending: true })
        .limit(100);

      if (isCpfSearch) {
        query = query.ilike("cpf_cnpj", queryText);
      } else {
        query = query.or(
          `email.ilike.${queryText},first_name.ilike.${queryText},last_name.ilike.${queryText},cpf_cnpj.ilike.${queryText}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((c) => ({
        user_id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        cpf_cnpj: c.cpf_cnpj,
        phone: c.phone,
        is_credit_card_enabled: c.is_credit_card_enabled,
      })) as ClientSearchResult[];
    },
    enabled: isOpen && !selectedClient,
    refetchOnWindowFocus: false,
  });

  // ── Preenche endereço ao selecionar cliente ─────────────────────────────────
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

  // ── Calcula frete ao mudar bairro/cidade ────────────────────────────────────
  useEffect(() => {
    if (!shippingAddress.neighborhood || !shippingAddress.city || !shippingRates) return;
    const neighborhood = shippingAddress.neighborhood.toLowerCase().trim();
    const city = shippingAddress.city.toLowerCase().trim();

    let match = (shippingRates as any[]).find(
      (r) => r.city.toLowerCase().trim() === city && r.neighborhood.toLowerCase().trim() === neighborhood
    );
    if (!match) {
      match = (shippingRates as any[]).find(
        (r) =>
          r.city.toLowerCase().trim() === city &&
          (r.neighborhood.toLowerCase().includes(neighborhood) ||
            neighborhood.includes(r.neighborhood.toLowerCase()))
      );
    }
    if (typeof match?.price !== "undefined" && shippingCost === "") {
      setShippingCost(String(Number(match.price)));
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  // ── Recalcula preços dos itens ao trocar forma de pagamento ─────────────────
  useEffect(() => {
    if (orderItems.length === 0) return;
    setOrderItems((prev) =>
      prev.map((item) => ({
        ...item,
        price: getEffectivePrice(item.basePrice, item.pixPrice, paymentMethod),
      }))
    );
  }, [paymentMethod]);

  // ── Totais ──────────────────────────────────────────────────────────────────
  const itemsTotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const finalShippingCost = chargeFreight ? Number(shippingCost || 0) : 0;
  const computedTotal = itemsTotal + finalShippingCost;

  // ── Selecionar cliente ──────────────────────────────────────────────────────
  const handleSelectClient = async (clientData: ClientSearchResult) => {
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

  // ── Busca produtos por nome ou SKU ──────────────────────────────────────────
  const searchProducts = async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return; }
    setSearchingProducts(true);
    try {
      const like = `%${term.trim()}%`;

      const { data: byName } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("name", like)
        .limit(100);

      const { data: bySku } = await supabase
        .from("products")
        .select("id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(*)")
        .ilike("sku", like)
        .limit(100);

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
    const timer = setTimeout(() => searchProducts(productSearch), 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // ── Adicionar produto/variação ao pedido ────────────────────────────────────
  const handleAddProduct = (product: Product, variant?: ProductVariant) => {
    const basePrice = variant ? Number(variant.price) : Number(product.price) || 0;
    const pixPrice = variant
      ? (variant.pix_price != null ? Number(variant.pix_price) : null)
      : (product.pix_price != null ? Number(product.pix_price) : null);
    const stockAvailable = variant ? variant.stock_quantity : product.stock_quantity;

    if (stockAvailable === 0) { showError("Produto sem estoque!"); return; }

    const effectivePrice = getEffectivePrice(basePrice, pixPrice, paymentMethod);

    const variantLabel = variant ? getVariantLabel(variant) : "";
    const nameToUse = variant
      ? `${product.name}${variantLabel ? ` - ${variantLabel}` : ""}`
      : product.name;

    const existingIndex = orderItems.findIndex(
      (item) => item.productId === product.id && item.variantId === (variant?.id || null)
    );

    if (existingIndex >= 0) {
      setOrderItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          productId: product.id,
          variantId: variant?.id || null,
          name: nameToUse,
          basePrice,
          pixPrice,
          price: effectivePrice,
          quantity: 1,
          imageUrl: product.image_url,
          stock: stockAvailable,
        },
      ]);
    }

    setProductSearch("");
    setSearchResults([]);
    setExpandedProduct(null);
  };

  const handleRemoveProduct = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeQuantity = (index: number, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        return { ...item, quantity: newQty };
      })
    );
  };

  // ── Criar pedido ────────────────────────────────────────────────────────────
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
        total_price: computedTotal,
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Pedido Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── 1. CLIENTE ── */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">1. Cliente</Label>

            {!selectedClient ? (
              <div className="relative" ref={clientDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou CPF (ou deixe em branco para ver todos)"
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>

                {searchingClients && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando clientes...
                  </div>
                )}

                {!searchingClients && clientSearchResults && clientSearchResults.length > 0 && (
                  <div className="space-y-0.5 max-h-56 overflow-y-auto border rounded-md p-1 mt-1 bg-white shadow-md z-10">
                    {clientSearchResults.map((client) => (
                      <div
                        key={client.user_id}
                        className="flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {client.first_name} {client.last_name}
                            </p>
                            {client.is_credit_card_enabled && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 bg-purple-50 shrink-0">
                                Crédito
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                          {client.cpf_cnpj && (
                            <p className="text-[10px] text-muted-foreground">CPF: {client.cpf_cnpj}</p>
                          )}
                        </div>
                        <Check className="h-4 w-4 text-green-600 shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}

                {!searchingClients && debouncedSearch.length >= 1 && clientSearchResults && clientSearchResults.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md mt-1">
                    <AlertCircle className="h-4 w-4" />
                    Nenhum cliente encontrado.
                  </div>
                )}
              </div>
            ) : (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {selectedClient.first_name} {selectedClient.last_name}
                        </p>
                        {selectedClient.is_credit_card_enabled && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 bg-purple-50">
                            Crédito
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                      {selectedClient.phone && (
                        <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                      )}
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

          {/* ── 2. FORMA DE PAGAMENTO ── */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">2. Forma de Pagamento</Label>
            <RadioGroup
              value={paymentMethod || ""}
              onValueChange={setPaymentMethod}
              className="grid grid-cols-2 gap-3"
            >
              {/* PIX */}
              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                  paymentMethod === "pix"
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/30"
                }`}
                onClick={() => setPaymentMethod("pix")}
              >
                <RadioGroupItem value="pix" id="pix" />
                <div className="flex items-center gap-2">
                  <QrCode className={`h-5 w-5 ${paymentMethod === "pix" ? "text-cyan-600" : "text-gray-400"}`} />
                  <div>
                    <Label htmlFor="pix" className="cursor-pointer font-semibold text-sm">PIX</Label>
                    <p className="text-[10px] text-muted-foreground">Preço PIX aplicado</p>
                  </div>
                </div>
              </div>

              {/* Cartão de Crédito */}
              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                  paymentMethod === "credit_card"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"
                }`}
                onClick={() => setPaymentMethod("credit_card")}
              >
                <RadioGroupItem value="credit_card" id="credit_card" />
                <div className="flex items-center gap-2">
                  <CreditCard className={`h-5 w-5 ${paymentMethod === "credit_card" ? "text-purple-600" : "text-gray-400"}`} />
                  <div>
                    <Label htmlFor="credit_card" className="cursor-pointer font-semibold text-sm">Cartão de Crédito</Label>
                    <p className="text-[10px] text-muted-foreground">Preço normal aplicado</p>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {!paymentMethod && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Selecione a forma de pagamento antes de adicionar produtos
              </p>
            )}
          </div>

          <Separator />

          {/* ── 3. PRODUTOS ── */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">3. Produtos</Label>

            {paymentMethod && (
              <div className={`text-xs px-3 py-1.5 rounded-md font-medium ${paymentMethod === "pix" ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                {paymentMethod === "pix"
                  ? "💰 Preços PIX aplicados automaticamente"
                  : "💳 Preços Cartão de Crédito aplicados automaticamente"}
              </div>
            )}

            {!paymentMethod && (
              <div className="text-xs px-3 py-1.5 rounded-md font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ⚠️ Selecione a forma de pagamento acima primeiro para aplicar os preços corretos
              </div>
            )}

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
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y bg-white shadow-sm">
                {searchResults.map((product) => {
                  const activeVariants = (product.product_variants || []).filter((v) => v.is_active);
                  const hasVariants = activeVariants.length > 0;
                  const isExpanded = expandedProduct === product.id;

                  return (
                    <div key={product.id}>
                      {/* Linha do produto */}
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
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-8 w-8 rounded object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            {!hasVariants && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {product.pix_price != null && Number(product.pix_price) > 0 ? (
                                  <>
                                    <span className="text-cyan-700 font-medium">PIX: {formatCurrency(Number(product.pix_price))}</span>
                                    <span>|</span>
                                    <span>Cartão: {formatCurrency(Number(product.price))}</span>
                                  </>
                                ) : (
                                  <span>{formatCurrency(Number(product.price))}</span>
                                )}
                                <span>· Estoque: {product.stock_quantity}</span>
                              </div>
                            )}
                            {hasVariants && (
                              <p className="text-xs text-muted-foreground">{activeVariants.length} variações disponíveis</p>
                            )}
                          </div>
                        </div>
                        {!hasVariants ? (
                          <Plus className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {/* Variações expandidas — TODAS as variações ativas */}
                      {hasVariants && isExpanded && (
                        <div className="bg-muted/20 divide-y border-t">
                          {sortVariantsBySpecification(activeVariants).map((variant) => {
                            const label = getVariantLabel(variant);
                            const hasPix = variant.pix_price != null && Number(variant.pix_price) > 0;
                            const effectivePrice = getEffectivePrice(
                              Number(variant.price),
                              hasPix ? Number(variant.pix_price) : null,
                              paymentMethod
                            );
                            return (
                              <div
                                key={variant.id}
                                className="flex items-center justify-between px-6 py-2 hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleAddProduct(product, variant)}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium">{label}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                    {hasPix ? (
                                      <>
                                        <span className="text-cyan-700 font-semibold">PIX: {formatCurrency(Number(variant.pix_price))}</span>
                                        <span>|</span>
                                        <span>Cartão: {formatCurrency(Number(variant.price))}</span>
                                      </>
                                    ) : (
                                      <span>{formatCurrency(Number(variant.price))}</span>
                                    )}
                                    <span>· Estoque: {variant.stock_quantity}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className={`text-xs font-bold ${paymentMethod === "pix" ? "text-cyan-700" : "text-purple-700"}`}>
                                    {formatCurrency(effectivePrice)}
                                  </span>
                                  <Plus className="h-3 w-3 text-green-600" />
                                </div>
                              </div>
                            );
                          })}
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
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={paymentMethod === "pix" ? "text-cyan-700 font-medium" : "text-purple-700 font-medium"}>
                            {formatCurrency(item.price)} cada
                          </span>
                          {item.pixPrice != null && item.pixPrice !== item.basePrice && (
                            <span className="text-[10px] opacity-60">
                              ({paymentMethod === "pix" ? "PIX" : "Cartão"})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleChangeQuantity(idx, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleChangeQuantity(idx, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold w-20 text-right shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveProduct(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── 4. ENDEREÇO DE ENTREGA ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">4. Endereço de Entrega</Label>
              {selectedClient && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                  onClick={() => {
                    setShippingAddress({
                      street: selectedClient.street || "",
                      number: selectedClient.number || "",
                      complement: selectedClient.complement || "",
                      neighborhood: selectedClient.neighborhood || "",
                      city: selectedClient.city || "",
                      state: selectedClient.state || "",
                      cep: selectedClient.cep || "",
                    });
                  }}
                >
                  ↺ Restaurar do cliente
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Rua / Logradouro</Label>
                <Input
                  value={shippingAddress.street}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, street: e.target.value }))}
                  placeholder="Rua das Flores"
                />
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input
                  value={shippingAddress.number}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, number: e.target.value }))}
                  placeholder="123"
                />
              </div>
              <div>
                <Label className="text-xs">Complemento</Label>
                <Input
                  value={shippingAddress.complement}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, complement: e.target.value }))}
                  placeholder="Apto 4"
                />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={shippingAddress.neighborhood}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, neighborhood: e.target.value }))}
                  placeholder="Centro"
                />
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <Input
                  value={shippingAddress.cep}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, cep: e.target.value }))}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, city: e.target.value }))}
                  placeholder="São Paulo"
                />
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Input
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress((p) => ({ ...p, state: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── 5. FRETE E OPÇÕES ── */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">5. Frete e Opções</Label>

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

          {/* ── RESUMO DO PEDIDO ── */}
          <div className="space-y-2 bg-muted/30 rounded-lg p-4">
            <Label className="text-base font-semibold">Resumo</Label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({orderItems.reduce((a, i) => a + i.quantity, 0)} itens)</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{chargeFreight ? formatCurrency(Number(shippingCost || 0)) : "Grátis"}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className={paymentMethod === "pix" ? "text-cyan-700" : paymentMethod === "credit_card" ? "text-purple-700" : ""}>
                  {formatCurrency(computedTotal)}
                </span>
              </div>
              {paymentMethod && (
                <p className="text-[10px] text-muted-foreground text-right">
                  {paymentMethod === "pix" ? "💰 Preços PIX" : "💳 Preços Cartão de Crédito"}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateOrder}
            disabled={isCreating || !selectedClient || orderItems.length === 0 || !paymentMethod}
            className={paymentMethod === "pix" ? "bg-cyan-600 hover:bg-cyan-700" : paymentMethod === "credit_card" ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              "Criar Pedido"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
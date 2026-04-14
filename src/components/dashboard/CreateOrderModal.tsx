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
  price: number | string;       // pode vir como string do Supabase
  pix_price: number | string | null;
  stock_quantity: number;
  is_active: boolean;
  color: string | null;
  ohms: string | null;
  size: string | null;
}

interface Product {
  id: number;
  name: string;
  price: number | string;
  pix_price: number | string | null;
  stock_quantity: number;
  image_url: string | null;
  sku: string | null;
  product_variants: ProductVariant[];
}

// Preços sempre guardados como number
interface OrderItem {
  productId: number;
  variantId: string | null;
  name: string;
  basePrice: number;       // preço cartão
  pixPrice: number | null; // preço pix (null = não tem)
  quantity: number;
  imageUrl: string | null;
  stock: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: number | string | null | undefined): number => {
  if (v == null) return 0;
  const parsed = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Retorna o preço efetivo baseado na forma de pagamento
const effectivePrice = (basePrice: number, pixPrice: number | null, paymentMethod: string | null): number => {
  if (paymentMethod === "pix" && pixPrice != null && pixPrice > 0) return pixPrice;
  return basePrice;
};

const getVariantLabel = (variant: ProductVariant): string =>
  [
    n(variant.volume_ml) > 0 ? `${variant.volume_ml}ml` : "",
    variant.color || "",
    variant.ohms ? `${variant.ohms}Ω` : "",
    variant.size ? `Tam ${variant.size}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || variant.sku || "Variação";

// ─── Componente ───────────────────────────────────────────────────────────────

export const CreateOrderModal = ({ isOpen, onClose }: CreateOrderModalProps) => {
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [shippingAddress, setShippingAddress] = useState({
    street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "",
  });

  // Itens: guardam basePrice e pixPrice separados — o preço efetivo é calculado no render
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [chargeFreight, setChargeFreight] = useState(true);
  const [shippingCost, setShippingCost] = useState<string>("");
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Busca clientes ──────────────────────────────────────────────────────────
  const { data: clientSearchResults, isLoading: searchingClients } = useQuery({
    queryKey: ["searchClients", debouncedSearch],
    queryFn: async () => {
      const term = debouncedSearch.trim();
      const base = supabase
        .from("profiles")
        .select("id, first_name, last_name, cpf_cnpj, email, phone, is_credit_card_enabled")
        .order("first_name", { ascending: true })
        .limit(100);

      const { data, error } = term
        ? await base.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`)
        : await base;

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
    const nbh = shippingAddress.neighborhood.toLowerCase().trim();
    const city = shippingAddress.city.toLowerCase().trim();
    const match = (shippingRates as any[]).find(
      (r) => r.city.toLowerCase().trim() === city &&
        (r.neighborhood.toLowerCase().trim() === nbh ||
          r.neighborhood.toLowerCase().includes(nbh) ||
          nbh.includes(r.neighborhood.toLowerCase()))
    );
    if (match?.price != null && shippingCost === "") {
      setShippingCost(String(n(match.price)));
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  // ── Totais calculados sempre com paymentMethod atual ────────────────────────
  const itemsTotal = orderItems.reduce(
    (acc, item) => acc + effectivePrice(item.basePrice, item.pixPrice, paymentMethod) * item.quantity,
    0
  );
  const finalShippingCost = chargeFreight ? n(shippingCost) : 0;
  const computedTotal = itemsTotal + finalShippingCost;

  // ── Selecionar cliente ──────────────────────────────────────────────────────
  const handleSelectClient = async (clientData: ClientSearchResult) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles").select("*").eq("id", clientData.user_id).maybeSingle();
      if (error) throw error;
      if (!profile) throw new Error("Perfil não encontrado");
      setSelectedClient(profile as Client);
      setSearchTerm("");
    } catch (err: any) {
      showError(err.message || "Erro ao carregar dados do cliente");
    }
  };

  // ── Busca produtos ──────────────────────────────────────────────────────────
  const searchProducts = async (term: string) => {
    if (!term.trim()) { setSearchResults([]); return; }
    setSearchingProducts(true);
    try {
      const like = `%${term.trim()}%`;
      const fields = "id, name, price, pix_price, stock_quantity, image_url, sku, product_variants(id, product_id, flavor_id, volume_ml, sku, price, pix_price, stock_quantity, is_active, color, ohms, size)";

      const [{ data: byName }, { data: bySku }, { data: byVariantSku }] = await Promise.all([
        supabase.from("products").select(fields).ilike("name", like).limit(100),
        supabase.from("products").select(fields).ilike("sku", like).limit(100),
        supabase
          .from("product_variants")
          .select(`id, product_id, flavor_id, volume_ml, sku, price, pix_price, stock_quantity, is_active, color, ohms, size, products(id, name, price, pix_price, stock_quantity, image_url, sku)`)
          .ilike("sku", like)
          .limit(100),
      ]);

      const map = new Map<number, Product>();
      (byName || []).forEach((p: any) => map.set(p.id, p));
      (bySku || []).forEach((p: any) => map.set(p.id, p));

      (byVariantSku || []).forEach((variantRow: any) => {
        const parent = variantRow.products;
        if (!parent) return;

        const existing = map.get(parent.id) || {
          ...parent,
          product_variants: [],
        };

        const variant: ProductVariant = {
          id: variantRow.id,
          product_id: variantRow.product_id,
          flavor_id: variantRow.flavor_id,
          volume_ml: variantRow.volume_ml,
          sku: variantRow.sku,
          price: variantRow.price,
          pix_price: variantRow.pix_price,
          stock_quantity: variantRow.stock_quantity,
          is_active: variantRow.is_active,
          color: variantRow.color,
          ohms: variantRow.ohms,
          size: variantRow.size,
        };

        const variants = Array.isArray(existing.product_variants) ? existing.product_variants : [];
        if (!variants.some((v: ProductVariant) => v.id === variant.id)) {
          existing.product_variants = [...variants, variant];
        }

        map.set(parent.id, existing);
      });

      setSearchResults(Array.from(map.values()));
    } catch {
      showError("Erro ao buscar produtos");
    } finally {
      setSearchingProducts(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 400);
    return () => clearTimeout(t);
  }, [productSearch]);

  // ── Adicionar produto/variação ──────────────────────────────────────────────
  const handleAddProduct = (product: Product, variant?: ProductVariant) => {
    const basePrice = n(variant ? variant.price : product.price);
    const rawPix = variant ? variant.pix_price : product.pix_price;
    const pixPrice = rawPix != null && n(rawPix) > 0 ? n(rawPix) : null;
    const stock = variant ? variant.stock_quantity : product.stock_quantity;

    if (stock === 0) { showError("Produto sem estoque!"); return; }

    const label = variant ? getVariantLabel(variant) : "";
    const name = variant ? `${product.name}${label ? ` - ${label}` : ""}` : product.name;

    const existingIdx = orderItems.findIndex(
      (item) => item.productId === product.id && item.variantId === (variant?.id || null)
    );

    if (existingIdx >= 0) {
      setOrderItems((prev) =>
        prev.map((item, i) => i === existingIdx ? { ...item, quantity: item.quantity + 1 } : item)
      );
    } else {
      setOrderItems((prev) => [
        ...prev,
        { productId: product.id, variantId: variant?.id || null, name, basePrice, pixPrice, quantity: 1, imageUrl: product.image_url, stock },
      ]);
    }

    setProductSearch("");
    setSearchResults([]);
    setExpandedProduct(null);
  };

  const handleRemoveProduct = (index: number) =>
    setOrderItems((prev) => prev.filter((_, i) => i !== index));

  const handleChangeQuantity = (index: number, delta: number) =>
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const qty = item.quantity + delta;
        return qty < 1 ? item : { ...item, quantity: qty };
      })
    );

  // ── Criar pedido ────────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!selectedClient) { showError("Selecione um cliente"); return; }
    if (orderItems.length === 0) { showError("Adicione ao menos um produto"); return; }
    if (!paymentMethod) { showError("Selecione a forma de pagamento"); return; }

    setIsCreating(true);
    try {
      // A função create_order no banco espera cart_items_input como jsonb
      // com campos: itemId, itemType, quantity, variantId
      const cartItems = orderItems.map((item) => ({
        itemId: item.productId,
        itemType: "product",
        quantity: item.quantity,
        variantId: item.variantId ?? null,
      }));

      const payload = {
        user_id_input: selectedClient.id,
        cart_items_input: cartItems,
        shipping_address_input: shippingAddress,
        shipping_cost_input: chargeFreight ? n(shippingCost) : 0,
        payment_method_input: paymentMethod === "pix" ? "Pix" : "Cartão de Crédito",
        donation_amount_input: 0,
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
              <div ref={clientDropdownRef}>
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando clientes...
                  </div>
                )}

                {!searchingClients && clientSearchResults && clientSearchResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto border rounded-md p-1 mt-1 bg-white shadow-md">
                    {clientSearchResults.map((client) => (
                      <div
                        key={client.user_id}
                        className="flex items-center justify-between px-3 py-2 rounded cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSelectClient(client)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{client.first_name} {client.last_name}</p>
                            {client.is_credit_card_enabled && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 bg-purple-50 shrink-0">Crédito</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                          {client.cpf_cnpj && <p className="text-[10px] text-muted-foreground">CPF: {client.cpf_cnpj}</p>}
                        </div>
                        <Check className="h-4 w-4 text-green-600 shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}

                {!searchingClients && debouncedSearch.length >= 1 && clientSearchResults?.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md mt-1">
                    <AlertCircle className="h-4 w-4" /> Nenhum cliente encontrado.
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
                        <p className="font-medium text-sm">{selectedClient.first_name} {selectedClient.last_name}</p>
                        {selectedClient.is_credit_card_enabled && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 bg-purple-50">Crédito</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                      {selectedClient.phone && <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>Trocar</Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* ── 2. FORMA DE PAGAMENTO ── */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">2. Forma de Pagamento</Label>
            <p className="text-xs text-muted-foreground">Escolha antes de adicionar produtos — o preço correto será aplicado automaticamente.</p>
            <RadioGroup value={paymentMethod || ""} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-3">
              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${paymentMethod === "pix" ? "border-cyan-500 bg-cyan-50" : "border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/30"}`}
                onClick={() => setPaymentMethod("pix")}
              >
                <RadioGroupItem value="pix" id="pix" />
                <div className="flex items-center gap-2">
                  <QrCode className={`h-5 w-5 ${paymentMethod === "pix" ? "text-cyan-600" : "text-gray-400"}`} />
                  <div>
                    <Label htmlFor="pix" className="cursor-pointer font-semibold text-sm">PIX</Label>
                    <p className="text-[10px] text-muted-foreground">Usa o preço PIX de cada produto</p>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${paymentMethod === "credit_card" ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/30"}`}
                onClick={() => setPaymentMethod("credit_card")}
              >
                <RadioGroupItem value="credit_card" id="credit_card" />
                <div className="flex items-center gap-2">
                  <CreditCard className={`h-5 w-5 ${paymentMethod === "credit_card" ? "text-purple-600" : "text-gray-400"}`} />
                  <div>
                    <Label htmlFor="credit_card" className="cursor-pointer font-semibold text-sm">Cartão de Crédito</Label>
                    <p className="text-[10px] text-muted-foreground">Usa o preço normal de cada produto</p>
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

            {paymentMethod ? (
              <div className={`text-xs px-3 py-1.5 rounded-md font-medium ${paymentMethod === "pix" ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                {paymentMethod === "pix" ? "💰 Preços PIX aplicados" : "💳 Preços Cartão de Crédito aplicados"}
              </div>
            ) : (
              <div className="text-xs px-3 py-1.5 rounded-md font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ⚠️ Selecione a forma de pagamento acima primeiro
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
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando produtos...
              </div>
            )}

            {!searchingProducts && searchResults.length > 0 && (
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y bg-white shadow-sm">
                {searchResults.map((product) => {
                  const activeVariants = (product.product_variants || []).filter((v) => v.is_active);
                  const hasVariants = activeVariants.length > 0;
                  const isExpanded = expandedProduct === product.id;

                  // Preços do produto sem variação
                  const prodBase = n(product.price);
                  const prodPix = product.pix_price != null && n(product.pix_price) > 0 ? n(product.pix_price) : null;
                  const prodEffective = effectivePrice(prodBase, prodPix, paymentMethod);

                  return (
                    <div key={product.id}>
                      <div
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => hasVariants ? setExpandedProduct(isExpanded ? null : product.id) : handleAddProduct(product)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name} className="h-8 w-8 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            {!hasVariants && (
                              <div className="flex items-center gap-2 text-xs mt-0.5">
                                {prodPix != null ? (
                                  <>
                                    <span className="text-cyan-700 font-semibold">PIX: {formatCurrency(prodPix)}</span>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="text-purple-700 font-semibold">Cartão: {formatCurrency(prodBase)}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className={`font-bold ${paymentMethod === "pix" ? "text-cyan-700" : "text-purple-700"}`}>
                                      {formatCurrency(prodEffective)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">{formatCurrency(prodBase)}</span>
                                )}
                                <span className="text-muted-foreground">· Estoque: {product.stock_quantity}</span>
                              </div>
                            )}
                            {hasVariants && (
                              <p className="text-xs text-muted-foreground">{activeVariants.length} variações</p>
                            )}
                          </div>
                        </div>
                        {!hasVariants
                          ? <Plus className="h-4 w-4 text-green-600 shrink-0" />
                          : isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </div>

                      {/* Variações — TODAS ativas */}
                      {hasVariants && isExpanded && (
                        <div className="bg-muted/20 divide-y border-t">
                          {sortVariantsBySpecification(activeVariants).map((variant) => {
                            const vBase = n(variant.price);
                            const vPix = variant.pix_price != null && n(variant.pix_price) > 0 ? n(variant.pix_price) : null;
                            const vEffective = effectivePrice(vBase, vPix, paymentMethod);
                            const label = getVariantLabel(variant);

                            return (
                              <div
                                key={variant.id}
                                className="flex items-center justify-between px-6 py-2 hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleAddProduct(product, variant)}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium">{label}</p>
                                  <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                    {vPix != null ? (
                                      <>
                                        <span className="text-cyan-700 font-semibold">PIX: {formatCurrency(vPix)}</span>
                                        <span className="text-muted-foreground">|</span>
                                        <span className="text-purple-700 font-semibold">Cartão: {formatCurrency(vBase)}</span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">{formatCurrency(vBase)}</span>
                                    )}
                                    <span className="text-muted-foreground">· Estoque: {variant.stock_quantity}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <span className={`text-sm font-bold ${paymentMethod === "pix" ? "text-cyan-700" : paymentMethod === "credit_card" ? "text-purple-700" : "text-gray-700"}`}>
                                    {formatCurrency(vEffective)}
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

            {/* Itens adicionados */}
            {orderItems.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-sm font-medium text-muted-foreground">Itens do pedido:</p>
                <div className="border rounded-md divide-y">
                  {orderItems.map((item, idx) => {
                    const price = effectivePrice(item.basePrice, item.pixPrice, paymentMethod);
                    return (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className={`font-semibold ${paymentMethod === "pix" ? "text-cyan-700" : "text-purple-700"}`}>
                              {formatCurrency(price)} cada
                            </span>
                            {item.pixPrice != null && (
                              <span className="text-muted-foreground text-[10px]">
                                (PIX: {formatCurrency(item.pixPrice)} | Cartão: {formatCurrency(item.basePrice)})
                              </span>
                            )}
                          </div>
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
                        <span className="text-sm font-bold w-20 text-right shrink-0">
                          {formatCurrency(price * item.quantity)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleRemoveProduct(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
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
                  variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                  onClick={() => setShippingAddress({
                    street: selectedClient.street || "",
                    number: selectedClient.number || "",
                    complement: selectedClient.complement || "",
                    neighborhood: selectedClient.neighborhood || "",
                    city: selectedClient.city || "",
                    state: selectedClient.state || "",
                    cep: selectedClient.cep || "",
                  })}
                >
                  ↺ Restaurar do cliente
                </Button>
              )}
            </div>
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
                <Input type="number" min="0" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="0,00" className="w-40" />
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

          {/* ── RESUMO ── */}
          <div className="space-y-2 bg-muted/30 rounded-lg p-4">
            <Label className="text-base font-semibold">Resumo</Label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({orderItems.reduce((a, i) => a + i.quantity, 0)} itens)</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{chargeFreight ? formatCurrency(n(shippingCost)) : "Grátis"}</span>
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
          <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancelar</Button>
          <Button
            onClick={handleCreateOrder}
            disabled={isCreating || !selectedClient || orderItems.length === 0 || !paymentMethod}
            className={paymentMethod === "pix" ? "bg-cyan-600 hover:bg-cyan-700" : paymentMethod === "credit_card" ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {isCreating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
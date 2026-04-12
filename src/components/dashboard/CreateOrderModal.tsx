"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Check, AlertCircle, MapPin, User, Package, DollarSign, Gift, Plus, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [clientConfirmed, setClientConfirmed] = useState(false);
  
  // Estados para busca de clientes
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [shippingAddress, setShippingAddress] = useState({
    street: "", number: "", complement: "", neighborhood: "", city: "", state: "", cep: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [chargeFreight, setChargeFreight] = useState(true);
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);
  const [shippingCost, setShippingCost] = useState(0);
  const [manualTotal, setManualTotal] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

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
    // Only set default shipping cost if user hasn't manually edited it (i.e., manualTotal empty and user hasn't typed into shippingCost)
    if (typeof match?.price !== 'undefined') {
      setShippingCost((prev) => prev === 0 ? Number(match.price) : prev);
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  const itemsTotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const finalShippingCost = chargeFreight ? Number(shippingCost || 0) : 0;
  const computedTotal = itemsTotal + finalShippingCost;
  const finalTotal = manualTotal && manualTotal.trim() !== "" ? Number(manualTotal) : computedTotal;

  // Selecionar cliente da lista de busca
  const handleSelectClient = async (clientData: ClientData) => {
    try {
      // Buscar perfil completo incluindo endereço
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", clientData.user_id)
        .maybeSingle();
      
      if (error) throw error;
      if (!profile) throw new Error("Perfil não encontrado");
      
      setSelectedClient(profile as Client);
      setClientConfirmed(false); // Requer confirmação do usuário
      setSearchTerm(""); // Limpar busca
    } catch (err: any) {
      showError(err.message || "Erro ao carregar dados do cliente");
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
      setOrderItems((prev) => prev.map((item, idx) => idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setOrderItems((prev) => [...prev, { productId: product.id, variantId: variant?.id || null, name: nameToUse, price: priceToUse, quantity: 1, imageUrl: product.image_url, stock: stockAvailable }]);
    }
  };

  const handleRemoveProduct = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setOrderItems((prev) => prev.map((item, idx) => idx === index ? { ...item, quantity } : item));
  };

  const handleCreateOrder = async () => {
    try {
      if (!selectedClient) { showError("Selecione um cliente"); return; }
      if (orderItems.length === 0) { showError("Adicione ao menos um produto"); return; }
      if (!paymentMethod) { showError("Selecione a forma de pagamento"); return; }

      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("id", selectedClient.id)
        .single();

      if (userError || !userData) throw new Error("Cliente não encontrado");

      const payload = {
        user_id: userData.id,
        items: orderItems.map((item) => ({
          item_id: item.productId,
          item_type: item.variantId ? 'variant' : 'product',
          quantity: item.quantity,
          price_at_purchase: item.price,
          name_at_purchase: item.name,
          variant_id: item.variantId,
        })),
        total_price: finalTotal,
        shipping_cost: chargeFreight ? shippingCost : 0,
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
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Pedido Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Buscar cliente</Label>
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
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {clientSearchResults.map((client) => (
                  <Card
                    key={client.user_id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectClient(client)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                          {client.cpf_cnpj && (
                            <p className="text-[10px] text-muted-foreground">CPF: {client.cpf_cnpj}</p>
                          )}
                        </div>
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!searchingClients && debouncedSearch.length >= 2 && clientSearchResults && clientSearchResults.length === 0 && (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Nenhum cliente encontrado.
                </CardContent>
              </Card>
            )}
          </div>

          {selectedClient && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <User className="h-4 w-4" />
                  Cliente selecionado
                </div>
                <div className="text-sm">
                  <p>{selectedClient.first_name} {selectedClient.last_name}</p>
                  <p className="text-muted-foreground">{selectedClient.email}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <Label>Produtos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto"
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
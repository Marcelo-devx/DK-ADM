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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  X,
  Check,
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
  
  // States
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [chargeFreight, setChargeFreight] = useState(true);
  const [generateLoyaltyPoints, setGenerateLoyaltyPoints] = useState(true);
  const [shippingCost, setShippingCost] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [searchingClient, setSearchingClient] = useState(false);
  const [clientNotFound, setClientNotFound] = useState(false);

  // Queries
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["products-with-variants", productSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          id,
          name,
          price,
          pix_price,
          stock_quantity,
          image_url,
          sku,
          is_visible,
          product_variants(*)
        `)
        .eq("is_visible", true)
        .order("name");

      if (productSearch) {
        const searchLower = productSearch.toLowerCase();
        query = query.ilike("name", `%${searchLower}%`);
      }

      const { data } = await query.limit(100);
      return data || [];
    },
    enabled: isOpen,
  });

  const { data: shippingRates } = useQuery({
    queryKey: ["shipping-rates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shipping_rates")
        .select("*")
        .eq("is_active", true);
      return data;
    },
    enabled: isOpen,
  });

  // Efeito para preencher endereço quando cliente é selecionado
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

  // Efeito para calcular frete quando endereço muda
  useEffect(() => {
    if (shippingAddress.neighborhood && shippingAddress.city && shippingRates) {
      const neighborhood = shippingAddress.neighborhood.toLowerCase().trim();
      const city = shippingAddress.city.toLowerCase().trim();

      // Tenta match exato de bairro e cidade
      let match = shippingRates.find(
        (r) =>
          r.city.toLowerCase().trim() === city &&
          r.neighborhood.toLowerCase().trim() === neighborhood
      );

      // Se não achar, tenta match parcial
      if (!match) {
        match = shippingRates.find(
          (r) =>
            r.city.toLowerCase().trim() === city &&
            (r.neighborhood.toLowerCase().includes(neighborhood) ||
              neighborhood.includes(r.neighborhood.toLowerCase()))
        );
      }

      setShippingCost(match?.price ? Number(match.price) : 0);
    }
  }, [shippingAddress.neighborhood, shippingAddress.city, shippingRates]);

  // Cálculos
  const itemsTotal = orderItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const finalShippingCost = chargeFreight ? shippingCost : 0;
  const finalTotal = itemsTotal + finalShippingCost;

  // Função de busca de cliente por email (não carrega todos os clientes)
  const findClientByEmail = async (email: string) => {
    if (!email) return null;
    setSearchingClient(true);
    setClientNotFound(false);
    setClientConfirmed(false);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setSelectedClient(null);
        setClientNotFound(true);
        return null;
      }

      setSelectedClient(data as Client);
      setClientNotFound(false);
      return data as Client;
    } catch (err: any) {
      showError(err.message || "Erro ao buscar cliente");
      setSelectedClient(null);
      setClientNotFound(true);
      return null;
    } finally {
      setSearchingClient(false);
    }
  };

  // Mutation para criar pedido
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Selecione um cliente");
      if (!clientConfirmed) throw new Error("Confirme o cliente antes de criar o pedido");
      if (orderItems.length === 0) throw new Error("Adicione produtos ao pedido");

      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: selectedClient.id,
          total_price: finalTotal,
          shipping_cost: finalShippingCost,
          status: "Pago",
          payment_method: "Pix",
          delivery_status: "Aguardando Coleta",
          shipping_address: shippingAddress,
          benefits_used: generateLoyaltyPoints ? null : "no_loyalty_points",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Inserir itens
      const itemsToInsert = orderItems.map((item) => ({
        order_id: order.id,
        item_id: item.variantId || item.productId,
        item_type: "product",
        quantity: item.quantity,
        price_at_purchase: item.price,
        name_at_purchase: item.name,
        image_url_at_purchase: item.imageUrl,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Atualizar estoque
      for (const item of orderItems) {
        if (item.variantId) {
          const { error: variantError } = await supabase.rpc(
            "decrement_variant_stock",
            { variant_id: item.variantId, quantity: item.quantity }
          );
          if (variantError) throw variantError;
        } else {
          const { error: productError } = await supabase.rpc("decrement_stock", {
            table_name: "products",
            row_id: item.productId,
            quantity: item.quantity,
          });
          if (productError) throw productError;
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordersAdmin"] });
      showSuccess("Pedido criado com sucesso!");
      handleClose();
    },
    onError: (error: any) => {
      showError(`Erro ao criar pedido: ${error.message}`);
    },
  });

  const handleClose = () => {
    setSelectedClient(null);
    setClientConfirmed(false);
    setEmailInput("");
    setOrderItems([]);
    setChargeFreight(true);
    setGenerateLoyaltyPoints(true);
    setShippingAddress({
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      cep: "",
    });
    setProductSearch("");
    setClientNotFound(false);
    onClose();
  };

  const handleAddProduct = (product: Product, variant?: ProductVariant) => {
    if (!product || product.stock_quantity === 0) return;

    const priceToUse = variant ? variant.price : product.price || 0;
    const nameToUse = variant
      ? `${product.name} - ${variant.flavor_id ? `Var ${variant.flavor_id}` : ""}${variant.volume_ml ? ` ${variant.volume_ml}ml` : ""}${variant.color ? ` ${variant.color}` : ""}${variant.size ? ` ${variant.size}` : ""}`.trim()
      : product.name;
    const stockAvailable = variant ? variant.stock_quantity : product.stock_quantity;
    const imageUrl = product.image_url;

    // Verifica se já existe o mesmo item
    const existingItemIndex = orderItems.findIndex(
      (item) =>
        item.productId === product.id &&
        item.variantId === (variant?.id || null)
    );

    if (existingItemIndex >= 0) {
      const existingItem = orderItems[existingItemIndex];
      const newQuantity = existingItem.quantity + 1;

      if (newQuantity > stockAvailable) {
        showError(
          `Estoque insuficiente! Disponível: ${stockAvailable} unidade(s)`
        );
        return;
      }

      setOrderItems((prev) => {
        const updated = [...prev];
        updated[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
        };
        return updated;
      });
    } else {
      setOrderItems((prev) => [
        ...prev,
        {
          productId: product.id,
          variantId: variant?.id || null,
          name: nameToUse,
          price: priceToUse,
          quantity: 1,
          imageUrl,
          stock: stockAvailable,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const item = orderItems[index];
    const newQuantity = Math.max(1, Math.min(item.stock, quantity));

    setOrderItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: newQuantity };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(
        2,
        7
      )}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Criar Pedido Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seção 1: Cliente - agora busca apenas por email, não carrega lista */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <Label className="text-base font-semibold">Cliente</Label>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar cliente por email..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    await findClientByEmail(emailInput.trim());
                  }
                }}
              />
              <Button
                onClick={async () => {
                  await findClientByEmail(emailInput.trim());
                }}
                variant="outline"
              >
                {searchingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {clientNotFound && (
              <div className="text-sm text-rose-600">Cliente não encontrado. Só é possível criar pedido para clientes cadastrados.</div>
            )}

            {selectedClient && (
              <div className="flex items-center justify-between mt-2 p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{selectedClient.first_name} {selectedClient.last_name}</div>
                  <div className="text-sm text-muted-foreground">{formatPhone(selectedClient.phone)} • {selectedClient.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={clientConfirmed} onChange={(e) => setClientConfirmed(e.target.checked)} />
                    <span className="text-sm">Confirmar cliente</span>
                  </label>
                  {clientConfirmed && <Check className="w-5 h-5 text-green-600" />}
                </div>
              </div>
            )}
          </div>

          {/* Seção 2: Endereço */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <Label className="text-base font-semibold">
                  Endereço de Entrega
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="street" className="text-sm">
                    Rua
                  </Label>
                  <Input
                    id="street"
                    placeholder="Rua"
                    value={shippingAddress.street}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, street: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="number" className="text-sm">
                    Número
                  </Label>
                  <Input
                    id="number"
                    placeholder="123"
                    value={shippingAddress.number}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="complement" className="text-sm">
                    Complemento
                  </Label>
                  <Input
                    id="complement"
                    placeholder="Apto, Bloco..."
                    value={shippingAddress.complement}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, complement: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood" className="text-sm">
                    Bairro
                  </Label>
                  <Input
                    id="neighborhood"
                    placeholder="Bairro"
                    value={shippingAddress.neighborhood}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, neighborhood: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="text-sm">
                    Cidade
                  </Label>
                  <Input
                    id="city"
                    placeholder="Cidade"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="state" className="text-sm">
                    Estado
                  </Label>
                  <Input
                    id="state"
                    placeholder="PR"
                    maxLength={2}
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, state: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cep" className="text-sm">
                    CEP
                  </Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={shippingAddress.cep}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, cep: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Seção 3: Produtos */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <Label className="text-base font-semibold">Produtos</Label>
              </div>

              <Command className="border rounded-lg">
                <div className="flex items-center px-3 border-b">
                  <Search className="w-4 h-4 mr-2 text-muted-foreground" />
                  <CommandInput
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onValueChange={setProductSearch}
                    className="border-0 focus-visible:ring-0"
                  />
                </div>
                <ScrollArea className="max-h-64">
                  <CommandList>
                    {loadingProducts ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : (
                      <CommandGroup>
                        {products?.map((product) => {
                          const hasVariants =
                            product.product_variants &&
                            product.product_variants.length > 0;
                          const activeVariants = hasVariants
                            ? product.product_variants.filter((v) => v.is_active)
                            : [];

                          // Se não tem variantes ativas, mostra o produto base
                          if (!hasVariants || activeVariants.length === 0) {
                            return (
                              <CommandItem
                                key={product.id}
                                disabled={product.stock_quantity === 0}
                                onSelect={() => handleAddProduct(product)}
                                className={cn(
                                  "cursor-pointer",
                                  product.stock_quantity === 0 &&
                                    "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  {product.image_url && (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  )}
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium">{product.name}</span>
                                    <div className="flex items-center gap-2 text-xs">
                                      <Badge variant="outline">
                                        {formatCurrency(product.price)}
                                      </Badge>
                                      {product.stock_quantity > 0 ? (
                                        <Badge variant="secondary">
                                          {product.stock_quantity} em estoque
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive">
                                          Sem estoque
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={product.stock_quantity === 0}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleAddProduct(product);
                                  }}
                                >
                                  Adicionar
                                </Button>
                              </CommandItem>
                            );
                          }

                          // Se tem variantes ativas, mostra cada variação
                          return (
                            <div key={product.id}>
                              <CommandItem
                                disabled
                                className="cursor-default font-semibold bg-muted"
                              >
                                <span className="flex-1">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {activeVariants.length} variação(ões)
                                </span>
                              </CommandItem>
                              {activeVariants.map((variant) => (
                                <CommandItem
                                  key={variant.id}
                                  disabled={variant.stock_quantity === 0}
                                  onSelect={() => handleAddProduct(product, variant)}
                                  className={cn(
                                    "pl-6 cursor-pointer",
                                    variant.stock_quantity === 0 &&
                                      "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {product.image_url && (
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-10 h-10 rounded object-cover"
                                      />
                                    )}
                                    <div className="flex flex-col flex-1">
                                      <span className="text-sm">
                                        {variant.flavor_id && `Sab ${variant.flavor_id} `}
                                        {variant.volume_ml && `${variant.volume_ml}ml `}
                                        {variant.color && `${variant.color} `}
                                        {variant.size && `Tam ${variant.size}`}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs">
                                        <Badge variant="outline">
                                          {formatCurrency(variant.price)}
                                        </Badge>
                                        {variant.stock_quantity > 0 ? (
                                          <Badge variant="secondary">
                                            {variant.stock_quantity} em estoque
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive">
                                            Sem estoque
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={variant.stock_quantity === 0}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleAddProduct(product, variant);
                                    }}
                                  >
                                    Adicionar
                                  </Button>
                                </CommandItem>
                              ))}
                            </div>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </ScrollArea>
              </Command>

              {/* Lista de itens selecionados */}
              {orderItems.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-semibold">
                    Itens do Pedido ({orderItems.length})
                  </Label>
                  {orderItems.map((item, index) => (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div className="flex flex-col flex-1">
                          <span className="font-medium text-sm">{item.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(item.price)} x {item.quantity} ={" "}
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Estoque disponível: {item.stock}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(index, parseInt(e.target.value))
                          }
                          className="w-20"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seção 4: Frete e Pontos de Fidelidade */}
          {selectedClient && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <div>
                    <Label className="font-semibold">Cobrar Frete</Label>
                    <p className="text-sm text-muted-foreground">
                      {chargeFreight
                        ? `Frete calculado: ${formatCurrency(shippingCost)}`
                        : "Frete não será cobrado"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={chargeFreight}
                  onCheckedChange={setChargeFreight}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-primary" />
                  <div>
                    <Label className="font-semibold">
                      Gerar Pontos de Fidelidade
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {generateLoyaltyPoints
                        ? "Cliente receberá pontos por este pedido"
                        : "Cliente NÃO receberá pontos"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={generateLoyaltyPoints}
                  onCheckedChange={setGenerateLoyaltyPoints}
                />
              </div>
            </div>
          )}

          {/* Seção 5: Resumo */}
          {selectedClient && orderItems.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <Label className="text-base font-semibold">Resumo do Pedido</Label>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Itens:</span>
                <span className="font-medium">{formatCurrency(itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                <span className="font-medium">
                  {formatCurrency(finalShippingCost)}
                </span>
              </div>
              {!generateLoyaltyPoints && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>⚠️ Pontos de fidelidade:</span>
                  <span>Não serão gerados</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => createOrderMutation.mutate()}
            disabled={
              !selectedClient ||
              !clientConfirmed ||
              orderItems.length === 0 ||
              createOrderMutation.isPending
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {createOrderMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Criar Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
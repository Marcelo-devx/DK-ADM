import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PromotionForm } from "@/components/dashboard/promotion-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff, Package, Layers, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PromotionItem = {
  quantity: number;
  products: { name: string } | null;
  product_variants: {
    flavors: { name: string } | null;
    volume_ml: number | null;
    color: string | null;
    ohms: string | null;
    size: string | null;
  } | null;
};

type Promotion = {
  id: number;
  name: string;
  image_url: string | null;
  is_active: boolean;
  price: number;
  pix_price: number;
  stock_quantity: number;
  description: string | null;
  discount_percent?: number;
  promotion_items: PromotionItem[];
};

function getVariantLabel(variant: {
  flavors?: { name: string } | null;
  volume_ml?: number | null;
  color?: string | null;
  ohms?: string | null;
  size?: string | null;
}): string {
  const parts: string[] = [];
  if (variant.flavors?.name) parts.push(variant.flavors.name);
  if (variant.color) parts.push(variant.color);
  if (variant.ohms) parts.push(variant.ohms);
  if (variant.size) parts.push(variant.size);
  if (variant.volume_ml) parts.push(`${variant.volume_ml}ml`);
  return parts.length > 0 ? parts.join(" / ") : "Padrão";
}

const fetchPromotions = async () => {
  const { data, error } = await supabase
    .from("promotions")
    .select(`*, promotion_items(quantity, products(name), product_variants(volume_ml, color, ohms, size, flavors(name)))`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as Promotion[];
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const PromotionsPage = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [suggestedData, setSuggestedData] = useState<Partial<Promotion> & { suggestedProductIds?: number[] } | null>(null);

  useEffect(() => {
    if (location.state && location.state.suggestedName) {
      setSuggestedData({
        name: location.state.suggestedName,
        description: location.state.suggestedDescription,
        stock_quantity: 0, price: 0, pix_price: 0, is_active: false,
        suggestedProductIds: location.state.suggestedProductIds,
      } as any);
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: ["promotions"],
    queryFn: fetchPromotions,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Promotion, "id" | "promotion_items"> & { id?: number }) => {
      const { data, error } = await supabase.from("promotions").upsert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
    onError: (error: Error) => showError(`Erro ao salvar kit: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Kit removido com sucesso!");
    },
    onError: (error: Error) => showError(`Erro ao remover kit: ${error.message}`),
  });

  const handleFormSubmit = (_values: { id: number; saved: true }) => {
    queryClient.invalidateQueries({ queryKey: ["promotions"] });
    setIsModalOpen(false);
    setSelectedPromotion(null);
    setSuggestedData(null);
    showSuccess("Kit salvo com sucesso!");
  };

  const handleStatusChange = (promo: Promotion, newStatus: boolean) => {
    const { promotion_items, ...promoData } = promo;
    upsertMutation.mutate({ ...promoData, is_active: newStatus });
  };

  const openEdit = (promo: Promotion) => { setSelectedPromotion(promo); setIsModalOpen(true); };
  const openDelete = (promo: Promotion) => { setSelectedPromotion(promo); setIsDeleteAlertOpen(true); };

  const modalContent = (
    <Dialog open={isModalOpen} onOpenChange={(open) => {
      setIsModalOpen(open);
      if (!open) { setSelectedPromotion(null); setSuggestedData(null); }
    }}>
      <DialogTrigger asChild>
        <Button className="font-bold">
          <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Kit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedPromotion ? "Editar Kit" : suggestedData ? "Criar Kit Sugerido" : "Novo Kit"}
          </DialogTitle>
        </DialogHeader>
        <PromotionForm
          onSubmit={handleFormSubmit}
          isSubmitting={false}
          initialData={selectedPromotion || suggestedData || undefined}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Package className="h-7 w-7 text-indigo-600" /> Kits e Promoções
        </h1>
        {modalContent}
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-28" />
          ))
        ) : promotions?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Nenhum kit encontrado.</p>
          </div>
        ) : (
          promotions?.map((promo) => (
            <div key={promo.id} className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4 space-y-3">
              {/* Imagem + nome + switch */}
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 rounded-xl border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {promo.image_url ? (
                    <img src={promo.image_url} alt={promo.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-base text-gray-900 leading-tight">{promo.name}</p>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={(v) => handleStatusChange(promo, v)}
                      disabled={upsertMutation.isPending}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-bold text-green-700 text-base">{fmt(promo.price)}</span>
                    {promo.pix_price > 0 && promo.pix_price !== promo.price && (
                      <span className="text-xs text-cyan-700 font-semibold">Pix: {fmt(promo.pix_price)}</span>
                    )}
                    <Badge variant={promo.stock_quantity > 0 ? "outline" : "destructive"} className="font-mono text-xs">
                      {promo.stock_quantity} un.
                    </Badge>
                    <Badge variant={promo.is_active ? "outline" : "secondary"} className={cn("text-xs", promo.is_active ? "text-green-700 border-green-300 bg-green-50" : "text-gray-500")}>
                      {promo.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Composição */}
              {promo.promotion_items && promo.promotion_items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Composição
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {promo.promotion_items.map((item, idx) => {
                      const variantInfo = item.product_variants ? getVariantLabel(item.product_variants) : null;
                      return (
                        <Badge key={idx} variant="secondary" className="text-xs bg-gray-100 text-gray-700 border-gray-200">
                          <span className="font-bold mr-1">{item.quantity}x</span>
                          {item.products?.name}
                          {variantInfo && variantInfo !== "Padrão" && (
                            <span className="text-gray-500 ml-1">({variantInfo})</span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEdit(promo)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => openDelete(promo)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>Nome do Kit</TableHead>
              <TableHead className="w-[300px]">Composição</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="text-center">Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Carregando kits...</TableCell></TableRow>
            ) : promotions && promotions.length > 0 ? (
              promotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    {promo.image_url ? (
                      <img src={promo.image_url} alt={promo.name} className="h-12 w-12 rounded-md object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center">
                        <ImageOff className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{promo.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {promo.promotion_items && promo.promotion_items.length > 0 ? (
                        promo.promotion_items.map((item, idx) => {
                          const variantInfo = item.product_variants ? getVariantLabel(item.product_variants) : null;
                          return (
                            <Badge key={idx} variant="secondary" className="w-fit text-[10px] font-normal px-2 py-0.5 bg-gray-100 text-gray-700">
                              <span className="font-bold mr-1">{item.quantity}x</span>
                              {item.products?.name}
                              {variantInfo && variantInfo !== "Padrão" && <span className="text-gray-500 ml-1">({variantInfo})</span>}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1"><Layers className="w-3 h-3" /> Kit Vazio</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{fmt(promo.price)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={promo.stock_quantity > 0 ? "outline" : "destructive"} className="font-mono">{promo.stock_quantity}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={promo.is_active} onCheckedChange={(v) => handleStatusChange(promo, v)} disabled={upsertMutation.isPending} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => openEdit(promo)}>Editar / Composição</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onSelect={() => openDelete(promo)}>Remover</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center">Nenhum kit encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover kit "{selectedPromotion?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Os itens serão devolvidos ao estoque.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedPromotion && deleteMutation.mutate(selectedPromotion.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PromotionsPage;

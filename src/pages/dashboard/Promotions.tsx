import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PromotionForm } from "@/components/dashboard/promotion-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff, Package, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

type PromotionItem = {
  quantity: number;
  products: { name: string } | null;
  product_variants: {
    flavors: { name: string } | null;
    volume_ml: number | null;
    color: string | null;
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

const fetchPromotions = async () => {
  const { data, error } = await supabase
    .from("promotions")
    .select(`
      *,
      promotion_items (
        quantity,
        products (name),
        product_variants (
          volume_ml,
          color,
          flavors (name)
        )
      )
    `)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as Promotion[];
};

const PromotionsPage = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  
  // Estado para dados vindos da IA (sugestão)
  const [suggestedData, setSuggestedData] = useState<Partial<Promotion> | null>(null);

  useEffect(() => {
    // Se vierem dados sugeridos via navegação (location state)
    if (location.state && location.state.suggestedName) {
        setSuggestedData({
            name: location.state.suggestedName,
            description: location.state.suggestedDescription,
            // Defaults seguros
            stock_quantity: 0,
            price: 0,
            pix_price: 0,
            is_active: false
        } as any);
        setIsModalOpen(true);
        // Limpa o estado da rota para não reabrir ao recarregar
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  const { data: promotions, isLoading: isLoadingPromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions"],
    queryFn: fetchPromotions,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Promotion, 'id' | 'promotion_items'> & { id?: number }) => {
      const { data, error } = await supabase.from('promotions').upsert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      
      if (!selectedPromotion) {
        // Se estava criando um novo (ou sugestão), mantém aberto e define como selecionado para mostrar a composição
        setSelectedPromotion(data as any);
        // Limpa a sugestão pois agora virou um item real
        setSuggestedData(null);
        showSuccess("Kit criado! Agora adicione os produtos abaixo.");
      } else {
        // Se estava editando, fecha
        setIsModalOpen(false);
        setSelectedPromotion(null);
        showSuccess("Kit atualizado com sucesso!");
      }
    },
    onError: (error: Error) => {
      showError(`Erro ao salvar kit: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (promotionId: number) => {
      const { error } = await supabase.from("promotions").delete().eq("id", promotionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Kit removido com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao remover kit: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    upsertMutation.mutate(values);
  };

  const handleDeleteConfirm = () => {
    if (!selectedPromotion) return;
    deleteMutation.mutate(selectedPromotion.id);
  };

  const handleStatusChange = (promotion: Promotion, newStatus: boolean) => {
    upsertMutation.mutate({ ...promotion, is_active: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kits e Promoções</h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) {
                setSelectedPromotion(null);
                setSuggestedData(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Kit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedPromotion ? "Editar Kit" : suggestedData ? "Criar Kit Sugerido (IA)" : "Adicionar Novo Kit"}
              </DialogTitle>
            </DialogHeader>
            <PromotionForm
              onSubmit={handleFormSubmit}
              isSubmitting={upsertMutation.isPending}
              initialData={selectedPromotion || suggestedData || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>Nome do Kit</TableHead>
              <TableHead className="w-[300px]">Composição (Itens)</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="text-center">Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingPromotions ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Carregando kits...
                </TableCell>
              </TableRow>
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
                  
                  {/* COLUNA COMPOSIÇÃO - NOVA */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {promo.promotion_items && promo.promotion_items.length > 0 ? (
                        promo.promotion_items.map((item, idx) => {
                          const hasVariant = !!item.product_variants;
                          const flavorName = item.product_variants?.flavors?.name;
                          const variantInfo = hasVariant 
                            ? `${flavorName || "Sabor Padrão"}` 
                            : "";
                          
                          return (
                            <Badge key={idx} variant="secondary" className="w-fit text-[10px] font-normal px-2 py-0.5 bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700">
                              <span className="font-bold mr-1">{item.quantity}x</span> 
                              {item.products?.name}
                              {variantInfo && <span className="text-gray-500 ml-1">({variantInfo})</span>}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                          <Layers className="w-3 h-3" /> Kit Vazio
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(promo.price)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={promo.stock_quantity > 0 ? "outline" : "destructive"} className="font-mono">
                      {promo.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={(newStatus) => handleStatusChange(promo, newStatus)}
                      disabled={upsertMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedPromotion(promo);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar / Composição
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedPromotion(promo);
                            setIsDeleteAlertOpen(true);
                          }}
                        >
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Nenhum kit encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o kit e devolverá os itens ao estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PromotionsPage;
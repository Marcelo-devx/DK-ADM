import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../integrations/supabase/client";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
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
import { SalesPopupForm } from "../../components/dashboard/SalesPopupForm";
import { showSuccess, showError } from "../../utils/toast";
import { PlusCircle, MoreHorizontal, ShoppingCart, ImageOff, Timer, Save, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SalesPopup = {
  id: number;
  customer_name: string;
  product_id: number | null;
  product_name: string;
  product_image_url: string | null;
  time_ago: string;
  is_active: boolean;
};

type ProductOption = {
  id: number;
  name: string;
  image_url: string | null;
};

const fetchSalesPopups = async () => {
  const { data, error } = await supabase
    .from("sales_popups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const fetchProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, image_url")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ProductOption[];
};

const SalesPopupsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedPopup, setSelectedPopup] = useState<SalesPopup | null>(null);
  const [popupInterval, setPopupInterval] = useState<string>("20");

  const { data: popups, isLoading } = useQuery<SalesPopup[]>({
    queryKey: ["sales_popups"],
    queryFn: fetchSalesPopups,
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery<ProductOption[]>({
    queryKey: ["productsForSalesPopup"],
    queryFn: fetchProducts,
  });

  const { data: settings } = useQuery({
    queryKey: ["sales_popup_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sales_popup_interval")
        .single();
      if (data) setPopupInterval(data.value);
      return data;
    }
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "sales_popup_interval", value: val }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Intervalo atualizado!"),
    onError: (err: any) => showError(err.message),
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<SalesPopup, 'id'> & { id?: number }) => {
      const { error } = await supabase.from('sales_popups').upsert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_popups"] });
      setIsModalOpen(false);
      setSelectedPopup(null);
      showSuccess("Popup de venda salvo com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao salvar popup de venda: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (popupId: number) => {
      const { error } = await supabase.from("sales_popups").delete().eq("id", popupId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_popups"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Popup de venda removido com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao remover popup de venda: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    const payload = selectedPopup ? { ...values, id: selectedPopup.id } : values;
    upsertMutation.mutate(payload);
  };

  const handleDeleteConfirm = () => {
    if (!selectedPopup) return;
    deleteMutation.mutate(selectedPopup.id);
  };

  const handleStatusChange = (popup: SalesPopup, newStatus: boolean) => {
    upsertMutation.mutate({ ...popup, is_active: newStatus });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-7 w-7" />
          <h1 className="text-3xl font-bold">Popups de Venda (Prova Social)</h1>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm px-4">
            <div className="flex flex-col">
                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                    <Timer className="w-3 h-3" /> Intervalo (Seg)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                    <Input 
                        type="number" 
                        value={popupInterval} 
                        onChange={(e) => setPopupInterval(e.target.value)}
                        className="w-20 h-8 font-bold"
                    />
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={() => updateIntervalMutation.mutate(popupInterval)}
                        disabled={updateIntervalMutation.isPending}
                    >
                        {updateIntervalMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                </div>
            </div>
            
            <div className="border-l pl-4 flex items-center h-full">
                <Dialog
                open={isModalOpen}
                onOpenChange={(isOpen) => {
                    setIsModalOpen(isOpen);
                    if (!isOpen) setSelectedPopup(null);
                }}
                >
                <DialogTrigger asChild>
                    <Button>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Adicionar Popup
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                    <DialogTitle>
                        {selectedPopup ? "Editar Popup de Venda" : "Adicionar Novo Popup de Venda"}
                    </DialogTitle>
                    </DialogHeader>
                    <SalesPopupForm
                    onSubmit={handleFormSubmit}
                    isSubmitting={upsertMutation.isPending}
                    initialData={selectedPopup || undefined}
                    products={products || []}
                    isLoadingProducts={isLoadingProducts}
                    />
                </DialogContent>
                </Dialog>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Carregando popups de venda...
                </TableCell>
              </TableRow>
            ) : popups && popups.length > 0 ? (
              popups.map((popup) => (
                <TableRow key={popup.id}>
                  <TableCell>
                    <div className="w-12 h-12 flex-shrink-0">
                      {popup.product_image_url ? (
                        <img
                          src={popup.product_image_url}
                          alt={popup.product_name}
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-full w-full rounded-md bg-gray-100 flex items-center justify-center">
                          <ImageOff className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{popup.customer_name}</TableCell>
                  <TableCell>{popup.product_name}</TableCell>
                  <TableCell>{popup.time_ago}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={popup.is_active}
                        onCheckedChange={(newStatus) => handleStatusChange(popup, newStatus)}
                        disabled={upsertMutation.isPending}
                      />
                      <Badge variant={popup.is_active ? "default" : "outline"}>
                        {popup.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
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
                            setSelectedPopup(popup);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedPopup(popup);
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
                <TableCell colSpan={6} className="text-center">
                  Nenhum popup de venda encontrado.
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
              Essa ação não pode ser desfeita. Isso removerá permanentemente o popup de venda.
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

export default SalesPopupsPage;
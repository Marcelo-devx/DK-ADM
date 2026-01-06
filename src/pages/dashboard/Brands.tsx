"use client";

import { useState } from "react";
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
import { BrandForm } from "@/components/dashboard/brand-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Brand = {
  id: number;
  name: string;
  created_at: string;
  image_url: string | null;
  is_visible: boolean;
};

const fetchBrands = async () => {
  const { data, error } = await supabase.from("brands").select("*").order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const BrandsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const { data: brands, isLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: fetchBrands,
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setIsModalOpen(false);
      setSelectedBrand(null);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  };

  const addMutation = useMutation({
    mutationFn: async (newBrand: Omit<Brand, "id" | "created_at">) => {
      const { error } = await supabase.from("brands").insert([newBrand]);
      if (error) throw new Error(error.message);
    },
    ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      showSuccess("Marca adicionada com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ brandId, values }: { brandId: number; values: Partial<Brand> }) => {
      const { error } = await supabase.from("brands").update(values).eq("id", brandId);
      if (error) throw new Error(error.message);
    },
    ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      showSuccess("Marca atualizada com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (brandId: number) => {
      const { error } = await supabase.from("brands").delete().eq('id', brandId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Marca removida com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover marca: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: Omit<Brand, "id" | "created_at">) => {
    if (selectedBrand) {
      updateMutation.mutate({ brandId: selectedBrand.id, values });
    } else {
      addMutation.mutate(values);
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedBrand) return;
    deleteMutation.mutate(selectedBrand.id);
  };

  const handleStatusChange = (brand: Brand, newStatus: boolean) => {
    updateMutation.mutate({
      brandId: brand.id,
      values: { is_visible: newStatus },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Marcas</h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) setSelectedBrand(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Marca
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedBrand ? "Editar Marca" : "Adicionar Nova Marca"}</DialogTitle>
            </DialogHeader>
            <BrandForm
              onSubmit={handleFormSubmit}
              isSubmitting={addMutation.isPending || updateMutation.isPending}
              initialData={selectedBrand || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Imagem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando marcas...
                </TableCell>
              </TableRow>
            ) : brands && brands.length > 0 ? (
              brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    {brand.image_url ? (
                      <img src={brand.image_url} alt={brand.name} className="h-12 w-12 rounded-md object-contain" />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center">
                        <ImageOff className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell>
                    {new Date(brand.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={brand.is_visible}
                        onCheckedChange={(newStatus) => handleStatusChange(brand, newStatus)}
                        disabled={updateMutation.isPending}
                      />
                      <Badge variant={brand.is_visible ? "default" : "outline"}>
                        {brand.is_visible ? "Visível" : "Oculta"}
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
                            setSelectedBrand(brand);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedBrand(brand);
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
                <TableCell colSpan={5} className="text-center">
                  Nenhuma marca encontrada.
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
              Essa ação não pode ser desfeita. Isso removerá permanentemente a marca.
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

export default BrandsPage;
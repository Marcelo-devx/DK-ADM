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
import { FlavorForm } from "@/components/dashboard/flavor-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, Leaf } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Flavor = {
  id: number;
  name: string;
  created_at: string;
  is_visible: boolean;
};

const fetchFlavors = async () => {
  const { data, error } = await supabase.from("flavors").select("*").order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const FlavorsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedFlavor, setSelectedFlavor] = useState<Flavor | null>(null);

  const { data: flavors, isLoading } = useQuery<Flavor[]>({
    queryKey: ["flavors"],
    queryFn: fetchFlavors,
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flavors"] });
      setIsModalOpen(false);
      setSelectedFlavor(null);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Flavor, "created_at"> & { id?: number }) => {
      const { error } = await supabase.from("flavors").upsert(values);
      if (error) throw new Error(error.message);
    },
    ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      showSuccess("Sabor salvo com sucesso!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (flavorId: number) => {
      const { error } = await supabase.from("flavors").delete().eq('id', flavorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flavors"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Sabor removido com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover sabor: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: Omit<Flavor, "created_at">) => {
    const payload = selectedFlavor ? { ...values, id: selectedFlavor.id } : values;
    upsertMutation.mutate(payload);
  };

  const handleDeleteConfirm = () => {
    if (!selectedFlavor) return;
    deleteMutation.mutate(selectedFlavor.id);
  };

  const handleStatusChange = (flavor: Flavor, newStatus: boolean) => {
    upsertMutation.mutate({ ...flavor, is_visible: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Leaf className="h-7 w-7" /> Sabores</h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) setSelectedFlavor(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Sabor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedFlavor ? "Editar Sabor" : "Adicionar Novo Sabor"}</DialogTitle>
            </DialogHeader>
            <FlavorForm
              onSubmit={handleFormSubmit}
              isSubmitting={upsertMutation.isPending}
              initialData={selectedFlavor || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando sabores...
                </TableCell>
              </TableRow>
            ) : flavors && flavors.length > 0 ? (
              flavors.map((flavor) => (
                <TableRow key={flavor.id}>
                  <TableCell className="font-medium">{flavor.name}</TableCell>
                  <TableCell>
                    {new Date(flavor.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={flavor.is_visible}
                        onCheckedChange={(newStatus) => handleStatusChange(flavor, newStatus)}
                        disabled={upsertMutation.isPending}
                      />
                      <Badge variant={flavor.is_visible ? "default" : "outline"}>
                        {flavor.is_visible ? "Visível" : "Oculta"}
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
                            setSelectedFlavor(flavor);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedFlavor(flavor);
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
                <TableCell colSpan={4} className="text-center">
                  Nenhum sabor encontrado.
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
              Essa ação removerá permanentemente o sabor e a associação com todos os produtos.
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

export default FlavorsPage;
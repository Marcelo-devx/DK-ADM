import { useState } from "react";
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
import { SubCategoryForm } from "../../components/dashboard/SubCategoryForm";
import { showSuccess, showError } from "../../utils/toast";
import { PlusCircle, MoreHorizontal, ListTree } from "lucide-react";
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

type SubCategory = {
  id: number;
  name: string;
  category_id: number;
  is_visible: boolean;
};

type Category = {
  id: number;
  name: string;
};

const fetchSubCategories = async () => {
  const { data, error } = await supabase.from("sub_categories").select("*").order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const fetchCategories = async () => {
  const { data, error } = await supabase.from("categories").select("id, name").eq('is_visible', true).order('name');
  if (error) throw new Error(error.message);
  return data;
};

const SubCategoriesPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);

  const { data: subCategories, isLoading: isLoadingSubCategories } = useQuery<SubCategory[]>({
    queryKey: ["sub_categories"],
    queryFn: fetchSubCategories,
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const categoryMap = new Map(categories?.map(c => [c.id, c.name]));

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<SubCategory, 'id'> & { id?: number }) => {
      const { error } = await supabase.from('sub_categories').upsert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub_categories"] });
      setIsModalOpen(false);
      setSelectedSubCategory(null);
      showSuccess("Sub-categoria salva com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao salvar sub-categoria: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (subCategoryId: number) => {
      const { error } = await supabase.from("sub_categories").delete().eq('id', subCategoryId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub_categories"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Sub-categoria removida com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover sub-categoria: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    const payload = selectedSubCategory ? { ...values, id: selectedSubCategory.id } : values;
    upsertMutation.mutate(payload);
  };

  const handleDeleteConfirm = () => {
    if (!selectedSubCategory) return;
    deleteMutation.mutate(selectedSubCategory.id);
  };

  const handleStatusChange = (subCategory: SubCategory, newStatus: boolean) => {
    upsertMutation.mutate({ ...subCategory, is_visible: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ListTree className="h-7 w-7" />
          <h1 className="text-3xl font-bold">Sub-categorias</h1>
        </div>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) setSelectedSubCategory(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Sub-categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{selectedSubCategory ? "Editar Sub-categoria" : "Adicionar Nova Sub-categoria"}</DialogTitle>
            </DialogHeader>
            <SubCategoryForm
              onSubmit={handleFormSubmit}
              isSubmitting={upsertMutation.isPending}
              initialData={selectedSubCategory || undefined}
              categories={categories || []}
              isLoadingCategories={isLoadingCategories}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria Pai</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingSubCategories ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  Carregando sub-categorias...
                </TableCell>
              </TableRow>
            ) : subCategories && subCategories.length > 0 ? (
              subCategories.map((subCategory) => (
                <TableRow key={subCategory.id}>
                  <TableCell className="font-medium">{subCategory.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{categoryMap.get(subCategory.category_id) || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={subCategory.is_visible}
                        onCheckedChange={(newStatus) => handleStatusChange(subCategory, newStatus)}
                        disabled={upsertMutation.isPending}
                      />
                      <Badge variant={subCategory.is_visible ? "default" : "outline"}>
                        {subCategory.is_visible ? "Visível" : "Oculta"}
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
                            setSelectedSubCategory(subCategory);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedSubCategory(subCategory);
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
                  Nenhuma sub-categoria encontrada.
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
              Essa ação não pode ser desfeita. Isso removerá permanentemente a sub-categoria.
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

export default SubCategoriesPage;
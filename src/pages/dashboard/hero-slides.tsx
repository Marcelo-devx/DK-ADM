"use client";

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
import { HeroSlideForm } from "@/components/dashboard/hero-slide-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, ImageOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type HeroSlide = {
  id: number;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  button_url: string | null;
  is_active: boolean;
  sort_order: number;
};

const fetchHeroSlides = async () => {
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const HeroSlidesPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<HeroSlide | null>(null);
  const [editableSortOrders, setEditableSortOrders] = useState<Record<number, string>>({});

  const { data: slides, isLoading } = useQuery<HeroSlide[]>({
    queryKey: ["hero_slides"],
    queryFn: fetchHeroSlides,
  });

  useEffect(() => {
    if (slides) {
      const initialOrders = slides.reduce((acc, slide) => {
        acc[slide.id] = String(slide.sort_order);
        return acc;
      }, {} as Record<number, string>);
      setEditableSortOrders(initialOrders);
    }
  }, [slides]);

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      setIsModalOpen(false);
      setSelectedSlide(null);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  };

  const addMutation = useMutation({
    mutationFn: async (newSlide: Omit<HeroSlide, "id" | "created_at" | "sort_order" | "button_text">) => {
      const { data: maxOrderResult, error: maxOrderError } = await supabase
        .from("hero_slides")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      if (maxOrderError && maxOrderError.code !== 'PGRST116') {
        throw maxOrderError;
      }

      const newSortOrder = maxOrderResult ? maxOrderResult.sort_order + 1 : 0;
      const slideToInsert = { ...newSlide, sort_order: newSortOrder };

      const { error } = await supabase.from("hero_slides").insert([slideToInsert]);
      if (error) throw new Error(error.message);
    },
    ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      showSuccess("Slide adicionado com sucesso!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      slideId,
      values,
    }: {
      slideId: number;
      values: Partial<HeroSlide>;
    }) => {
      const { error } = await supabase
        .from("hero_slides")
        .update(values)
        .eq("id", slideId);
      if (error) throw new Error(error.message);
    },
    ...mutationOptions,
    onSuccess: () => {
      mutationOptions.onSuccess();
      showSuccess("Slide atualizado com sucesso!");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; sort_order: number }[]) => {
      const { error } = await supabase.from("hero_slides").upsert(updates);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      showSuccess("Ordem atualizada com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao reordenar: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slideId: number) => {
      const { error } = await supabase
        .from("hero_slides")
        .delete()
        .eq("id", slideId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Slide removido com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao remover slide: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    if (selectedSlide) {
      updateMutation.mutate({ slideId: selectedSlide.id, values });
    } else {
      addMutation.mutate(values);
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedSlide) return;
    deleteMutation.mutate(selectedSlide.id);
  };

  const handleStatusChange = (slide: HeroSlide, newStatus: boolean) => {
    updateMutation.mutate({
      slideId: slide.id,
      values: { is_active: newStatus },
    });
  };

  const handleSortOrderChange = (slideId: number, value: string) => {
    setEditableSortOrders(prev => ({
      ...prev,
      [slideId]: value,
    }));
  };

  const handleSortOrderSave = (slideId: number) => {
    if (!slides) return;

    const newOrderStr = editableSortOrders[slideId];
    const originalSlide = slides.find(s => s.id === slideId);

    if (!originalSlide) return;
    const originalOrder = originalSlide.sort_order;

    if (newOrderStr === undefined) return;
    
    const newOrder = parseInt(newOrderStr, 10);

    if (isNaN(newOrder) || newOrder < 0 || newOrder >= slides.length) {
      showError(`Por favor, insira um número de ordem entre 0 e ${slides.length - 1}.`);
      setEditableSortOrders(prev => ({ ...prev, [slideId]: String(originalOrder) }));
      return;
    }
    
    if (newOrder === originalOrder) return;

    const otherItem = slides.find(s => s.sort_order === newOrder);
    if (!otherItem) {
      showError("Ocorreu um erro: a ordem de destino não foi encontrada. A lista será recarregada.");
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      return;
    }

    const updates = [
      { id: slideId, sort_order: newOrder },
      { id: otherItem.id, sort_order: originalOrder }
    ];

    reorderMutation.mutate(updates);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Hero Slides</h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) setSelectedSlide(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Slide
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedSlide ? "Editar Slide" : "Adicionar Novo Slide"}
              </DialogTitle>
            </DialogHeader>
            <HeroSlideForm
              onSubmit={handleFormSubmit}
              isSubmitting={addMutation.isPending || updateMutation.isPending}
              initialData={selectedSlide ? {
                ...selectedSlide,
                title: selectedSlide.title || '',
                subtitle: selectedSlide.subtitle || '',
                button_url: selectedSlide.button_url || '',
                image_url: selectedSlide.image_url || '',
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imagem</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando slides...
                </TableCell>
              </TableRow>
            ) : slides && slides.length > 0 ? (
              slides.map((slide) => (
                <TableRow key={slide.id}>
                  <TableCell>
                    {slide.image_url ? (
                      <img src={slide.image_url} alt={slide.title || ''} className="h-12 w-24 rounded-md object-cover" />
                    ) : (
                      <div className="h-12 w-24 rounded-md bg-gray-100 flex items-center justify-center">
                        <ImageOff className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{slide.title}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={editableSortOrders[slide.id] ?? ''}
                      onChange={(e) => handleSortOrderChange(slide.id, e.target.value)}
                      onBlur={() => handleSortOrderSave(slide.id)}
                      className="w-20"
                      disabled={reorderMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={slide.is_active}
                        onCheckedChange={(newStatus) => handleStatusChange(slide, newStatus)}
                        disabled={updateMutation.isPending || reorderMutation.isPending}
                      />
                      <Badge variant={slide.is_active ? "default" : "outline"}>
                        {slide.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={reorderMutation.isPending}>
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedSlide(slide);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedSlide(slide);
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
                  Nenhum slide encontrado.
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
              Essa ação não pode ser desfeita. Isso removerá permanentemente o slide.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HeroSlidesPage;
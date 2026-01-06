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
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, GalleryHorizontal, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoBarItemForm } from "@/components/dashboard/info-bar-item-form";
import { InfoCardForm } from "@/components/dashboard/info-card-form";
import * as Icons from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { InlineImageUploader } from "@/components/dashboard/InlineImageUploader";

// Types
type InfoBarItem = {
  id: number;
  icon_name: string;
  title: string;
  subtitle: string;
  is_visible: boolean;
  sort_order: number;
};

type InfoCard = {
  id: number;
  image_url: string;
  link_url: string | null;
  is_visible: boolean;
  is_link_active: boolean;
  sort_order: number;
};

// Fetch functions
const fetchInfoBarItems = async () => {
  const { data, error } = await supabase.from("info_bar_items").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data;
};

const fetchInfoCards = async () => {
  const { data, error } = await supabase.from("info_cards").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data;
};

const HomeContentPage = () => {
  const queryClient = useQueryClient();

  // State for modals and selected items
  const [isInfoBarModalOpen, setIsInfoBarModalOpen] = useState(false);
  const [selectedInfoBarItem, setSelectedInfoBarItem] = useState<InfoBarItem | null>(null);
  const [isInfoBarDeleteAlertOpen, setIsInfoBarDeleteAlertOpen] = useState(false);

  const [isInfoCardModalOpen, setIsInfoCardModalOpen] = useState(false);
  const [selectedInfoCard, setSelectedInfoCard] = useState<InfoCard | null>(null);
  const [isInfoCardDeleteAlertOpen, setIsInfoCardDeleteAlertOpen] = useState(false);

  // Queries
  const { data: infoBarItems, isLoading: isLoadingInfoBar } = useQuery<InfoBarItem[]>({
    queryKey: ["info_bar_items"],
    queryFn: fetchInfoBarItems,
  });

  const { data: infoCards, isLoading: isLoadingInfoCards } = useQuery<InfoCard[]>({
    queryKey: ["info_cards"],
    queryFn: fetchInfoCards,
  });

  // Mutations
  const upsertInfoBarItemMutation = useMutation({
    mutationFn: async (values: Partial<InfoBarItem> & { id: number }) => {
      const { error } = await supabase.from('info_bar_items').update(values).eq('id', values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["info_bar_items"] });
      showSuccess("Item da barra de informações salvo!");
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const addInfoBarItemMutation = useMutation({
    mutationFn: async (values: Omit<InfoBarItem, 'id' | 'sort_order'>) => {
        const { error } = await supabase.from('info_bar_items').insert(values);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["info_bar_items"] });
        setIsInfoBarModalOpen(false);
        setSelectedInfoBarItem(null);
        showSuccess("Item da barra de informações adicionado!");
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const deleteInfoBarItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("info_bar_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["info_bar_items"] });
      setIsInfoBarDeleteAlertOpen(false);
      showSuccess("Item removido com sucesso!");
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const upsertInfoCardMutation = useMutation({
    mutationFn: async (values: Partial<InfoCard> & { id: number }) => {
      const { error } = await supabase.from('info_cards').update(values).eq('id', values.id);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["info_cards"] });
      if (Object.keys(variables).length > 2) { // More than just id and one value
        showSuccess("Card de informações salvo!");
      }
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const addInfoCardMutation = useMutation({
    mutationFn: async (values: Omit<InfoCard, 'id' | 'sort_order'>) => {
        const { error } = await supabase.from('info_cards').insert(values);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["info_cards"] });
        setIsInfoCardModalOpen(false);
        setSelectedInfoCard(null);
        showSuccess("Card de informações adicionado!");
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  const deleteInfoCardMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("info_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["info_cards"] });
      setIsInfoCardDeleteAlertOpen(false);
      showSuccess("Card removido com sucesso!");
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

  // Handlers
  const handleInfoBarSubmit = (values: any) => {
    if (selectedInfoBarItem) {
        upsertInfoBarItemMutation.mutate({ ...values, id: selectedInfoBarItem.id });
    } else {
        addInfoBarItemMutation.mutate(values);
    }
  };

  const handleInfoBarVisibilityChange = (item: InfoBarItem, newStatus: boolean) => {
    upsertInfoBarItemMutation.mutate({ id: item.id, is_visible: newStatus });
  };

  const handleInfoCardSubmit = (values: any) => {
    if (selectedInfoCard) {
        upsertInfoCardMutation.mutate({ ...values, id: selectedInfoCard.id });
    } else {
        addInfoCardMutation.mutate(values);
    }
  };

  const handleLinkActiveChange = (card: InfoCard, newStatus: boolean) => {
    if (!card.link_url && newStatus) {
      showError("Não é possível ativar o link pois a URL não está definida.");
      return;
    }
    upsertInfoCardMutation.mutate({ id: card.id, is_link_active: newStatus });
  };

  const handleVisibilityChange = (card: InfoCard, newStatus: boolean) => {
    upsertInfoCardMutation.mutate({ id: card.id, is_visible: newStatus });
  };

  const handleImageUpdate = (cardId: number, newUrl: string) => {
    upsertInfoCardMutation.mutate({ id: cardId, image_url: newUrl });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Conteúdo da Home</h1>
      </div>

      <Tabs defaultValue="info-bar">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info-bar">
            <Info className="mr-2 h-4 w-4" /> Barra de Informações
          </TabsTrigger>
          <TabsTrigger value="info-cards">
            <GalleryHorizontal className="mr-2 h-4 w-4" /> Cards de Informações
          </TabsTrigger>
        </TabsList>

        {/* Info Bar Content */}
        <TabsContent value="info-bar">
          <Card>
            <CardHeader>
              <CardTitle>Itens da Barra de Informações</CardTitle>
              <CardDescription>Gerencie os ícones e textos que aparecem na barra de informações da sua loja.</CardDescription>
              <Dialog open={isInfoBarModalOpen} onOpenChange={(isOpen) => { setIsInfoBarModalOpen(isOpen); if (!isOpen) setSelectedInfoBarItem(null); }}>
                <DialogTrigger asChild>
                  <Button className="mt-4 w-fit">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Adicionar Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{selectedInfoBarItem ? "Editar Item" : "Adicionar Novo Item"}</DialogTitle>
                  </DialogHeader>
                  <InfoBarItemForm
                    onSubmit={handleInfoBarSubmit}
                    isSubmitting={addInfoBarItemMutation.isPending || upsertInfoBarItemMutation.isPending}
                    initialData={selectedInfoBarItem || undefined}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ícone</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Subtítulo</TableHead>
                    <TableHead>Visibilidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingInfoBar ? (
                    <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
                  ) : infoBarItems?.map((item) => {
                    const IconComponent = (Icons as any)[item.icon_name] || Icons.HelpCircle;
                    return (
                      <TableRow key={item.id}>
                        <TableCell><IconComponent className="h-6 w-6" /></TableCell>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>{item.subtitle}</TableCell>
                        <TableCell>
                          <Switch
                            checked={item.is_visible}
                            onCheckedChange={(newStatus) => handleInfoBarVisibilityChange(item, newStatus)}
                            disabled={upsertInfoBarItemMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => { setSelectedInfoBarItem(item); setIsInfoBarModalOpen(true); }}>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedInfoBarItem(item); setIsInfoBarDeleteAlertOpen(true); }}>Remover</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Cards Content */}
        <TabsContent value="info-cards">
          <Card>
            <CardHeader>
              <CardTitle>Cards de Informações</CardTitle>
              <CardDescription>Gerencie os cards com imagens e links que aparecem na sua página inicial.</CardDescription>
              <Dialog open={isInfoCardModalOpen} onOpenChange={(isOpen) => { setIsInfoCardModalOpen(isOpen); if (!isOpen) setSelectedInfoCard(null); }}>
                <DialogTrigger asChild>
                  <Button className="mt-4 w-fit">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Adicionar Card
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{selectedInfoCard ? "Editar Card" : "Adicionar Novo Card"}</DialogTitle>
                  </DialogHeader>
                  <InfoCardForm
                    onSubmit={handleInfoCardSubmit}
                    isSubmitting={addInfoCardMutation.isPending || upsertInfoCardMutation.isPending}
                    initialData={selectedInfoCard || undefined}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imagem</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Link Ativo</TableHead>
                    <TableHead>Visibilidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingInfoCards ? (
                    <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
                  ) : infoCards?.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <InlineImageUploader
                          cardId={card.id}
                          initialUrl={card.image_url}
                          onUploadSuccess={handleImageUpdate}
                        />
                      </TableCell>
                      <TableCell>{card.link_url || "-"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={card.is_link_active}
                          onCheckedChange={(newStatus) => handleLinkActiveChange(card, newStatus)}
                          disabled={!card.link_url || upsertInfoCardMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={card.is_visible}
                          onCheckedChange={(newStatus) => handleVisibilityChange(card, newStatus)}
                          disabled={upsertInfoCardMutation.isPending}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setSelectedInfoCard(card); setIsInfoCardModalOpen(true); }}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedInfoCard(card); setIsInfoCardDeleteAlertOpen(true); }}>Remover</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Alerts */}
      <AlertDialog open={isInfoBarDeleteAlertOpen} onOpenChange={setIsInfoBarDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá o item permanentemente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedInfoBarItem && deleteInfoBarItemMutation.mutate(selectedInfoBarItem.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isInfoCardDeleteAlertOpen} onOpenChange={setIsInfoCardDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá o card permanentemente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedInfoCard && deleteInfoCardMutation.mutate(selectedInfoCard.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HomeContentPage;
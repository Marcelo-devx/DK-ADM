"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PopupForm } from "@/components/dashboard/PopupForm";
import { Trash2, AlertCircle, Info, Plus, Pencil, Eye, ArrowDownUp } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PopupsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPopup, setSelectedPopup] = useState<any>(null);
  const [isPreviewOnly, setIsPreviewOnly] = useState(false);

  const { data: popups, isLoading } = useQuery({
    queryKey: ["popups-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informational_popups")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: any) => {
      if (isPreviewOnly) return;
      const { error } = await supabase
        .from("informational_popups")
        .upsert(values, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      if (isPreviewOnly) return;
      queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
      showSuccess(selectedPopup ? "Aviso atualizado!" : "Novo aviso criado!");
      setIsModalOpen(false);
      setSelectedPopup(null);
    },
    onError: (err: any) => showError(`Erro ao salvar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("informational_popups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
      showSuccess("Popup removido.");
    },
    onError: (err: any) => showError(`Erro ao excluir: ${err.message}`),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: number, currentState: boolean }) => {
       const newStatus = !currentState;
       const { error } = await supabase.from("informational_popups").update({ is_active: newStatus }).eq("id", id);
       if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
        showSuccess("Status de ativação atualizado!");
    },
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  const handleEdit = (popup: any) => {
    setSelectedPopup(popup);
    setIsPreviewOnly(false);
    setIsModalOpen(true);
  };

  const handleViewPreview = (popup: any) => {
    setSelectedPopup(popup);
    setIsPreviewOnly(true);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
      setSelectedPopup(null);
      setIsPreviewOnly(false);
      setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg"><Info className="h-6 w-6 text-primary" /></div>
          <h1 className="text-3xl font-bold">Popups Informativos</h1>
        </div>
        
        <Button onClick={handleOpenNew} className="bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg">
            <Plus className="w-5 h-5 mr-2" /> Novo Aviso
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) setSelectedPopup(null); }}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="text-xl font-bold">
                    {isPreviewOnly ? "Visualizando Aviso" : selectedPopup ? `Editando: ${selectedPopup.title}` : "Criar Novo Popup Informativo"}
                  </DialogTitle>
              </DialogHeader>
              <PopupForm 
                  onSubmit={(v) => upsertMutation.mutate(v)} 
                  isSubmitting={upsertMutation.isPending}
                  initialData={selectedPopup || undefined}
              />
          </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
        ) : popups && popups.length > 0 ? (
          popups.map(popup => (
              <Card key={popup.id} className={popup.is_active ? "border-green-500 border-2 shadow-xl ring-4 ring-green-500/5 relative overflow-hidden" : "opacity-80 border-dashed"}>
                  <CardHeader className="pb-3 border-b bg-gray-50/50">
                      <CardTitle className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Badge variant="outline" className="bg-white shrink-0"><ArrowDownUp className="w-3 h-3 mr-1" /> {popup.sort_order}</Badge>
                            <span className="text-base font-bold line-clamp-1">{popup.title}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewPreview(popup)}><Eye className="w-4 h-4 text-gray-500" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(popup)}><Pencil className="w-4 h-4 text-blue-600" /></Button>
                          </div>
                      </CardTitle>
                      <div className="flex mt-1">
                        {popup.is_active ? (
                            <Badge className="bg-green-500 text-[10px] uppercase font-black">Em exibição</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold">Pausado</Badge>
                          )}
                      </div>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 py-4">
                      <div 
                        className="line-clamp-4 italic bg-gray-50 p-3 rounded-lg border border-gray-100 overflow-hidden max-h-[100px]"
                        dangerouslySetInnerHTML={{ __html: popup.content }}
                      />
                  </CardContent>
                  <CardFooter className="flex justify-between pt-3 border-t bg-gray-50/30">
                      <Button 
                          variant={popup.is_active ? "outline" : "default"}
                          size="sm"
                          className={popup.is_active ? "text-orange-600 border-orange-200 hover:bg-orange-50 font-bold" : "bg-green-600 hover:bg-green-700 font-bold"}
                          onClick={() => toggleActiveMutation.mutate({ id: popup.id, currentState: popup.is_active })}
                          disabled={toggleActiveMutation.isPending}
                      >
                          {popup.is_active ? "Desativar" : "Ativar no Site"}
                      </Button>
                      <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { if(confirm("Deseja realmente apagar este aviso?")) deleteMutation.mutate(popup.id); }}
                          disabled={deleteMutation.isPending}
                      >
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
                      </Button>
                  </CardFooter>
              </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <AlertCircle className="h-10 w-10 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider">Nenhum aviso criado</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupsPage;
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PopupForm } from "@/components/dashboard/PopupForm";
import { Trash2, AlertCircle, Info } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const PopupsPage = () => {
  const queryClient = useQueryClient();

  const { data: popups, isLoading } = useQuery({
    queryKey: ["popups-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informational_popups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("informational_popups").insert([values]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
      showSuccess("Novo popup informativo criado!");
    },
    onError: (err: any) => showError(`Erro ao criar: ${err.message}`),
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
       
       // Se estiver ativando, desativa todos os outros (lógica de apenas 1 ativo)
       if (newStatus) {
         await supabase.from("informational_popups").update({ is_active: false }).neq("id", id);
       }
       
       const { error } = await supabase.from("informational_popups").update({ is_active: newStatus }).eq("id", id);
       if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
        showSuccess("Status de ativação atualizado!");
    },
    onError: (err: any) => showError(`Erro ao alterar status: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Info className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Popups Informativos</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
           <Card>
             <CardHeader>
               <CardTitle className="text-lg">Adicionar Novo Aviso</CardTitle>
             </CardHeader>
             <CardContent>
               <PopupForm 
                onSubmit={(v) => addMutation.mutate(v)} 
                isSubmitting={addMutation.isPending} 
               />
             </CardContent>
           </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Avisos Cadastrados
            {popups && <Badge variant="secondary">{popups.length}</Badge>}
          </h2>
          
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : popups && popups.length > 0 ? (
            popups.map(popup => (
                <Card key={popup.id} className={popup.is_active ? "border-green-500 border-2 shadow-md" : "opacity-75"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex justify-between items-center text-lg">
                            <span className="truncate">{popup.title}</span>
                            {popup.is_active ? (
                              <Badge className="bg-green-500">Ativo no Site</Badge>
                            ) : (
                              <Badge variant="outline">Inativo</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 pb-2">
                        <p className="line-clamp-3 italic">"{popup.content}"</p>
                        <p className="mt-2 text-xs font-bold text-gray-400">Botão: {popup.button_text}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between pt-2 border-t mt-2">
                        <Button 
                            variant={popup.is_active ? "outline" : "default"}
                            size="sm"
                            className={popup.is_active ? "text-orange-600 border-orange-200" : "bg-green-600 hover:bg-green-700"}
                            onClick={() => toggleActiveMutation.mutate({ id: popup.id, currentState: popup.is_active })}
                            disabled={toggleActiveMutation.isPending}
                        >
                            {popup.is_active ? "Desativar Aviso" : "Ativar no Site"}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => { if(confirm("Tem certeza que deseja excluir este aviso?")) deleteMutation.mutate(popup.id); }}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </Button>
                    </CardFooter>
                </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
                <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Nenhum aviso configurado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopupsPage;
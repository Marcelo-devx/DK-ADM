"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PopupForm } from "@/components/dashboard/popup-form";
import { Trash2 } from "lucide-react";
import { showSuccess } from "@/utils/toast";

const PopupsPage = () => {
  const queryClient = useQueryClient();

  const { data: popups, isLoading } = useQuery({
    queryKey: ["popups-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("informational_popups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
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
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: number, currentState: boolean }) => {
       if (!currentState) {
         await supabase.from("informational_popups").update({ is_active: false }).neq("id", id);
       }
       const { error } = await supabase.from("informational_popups").update({ is_active: !currentState }).eq("id", id);
       if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["popups-admin"] });
        showSuccess("Status atualizado.");
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Popups Informativos</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
           <h2 className="text-xl font-semibold mb-4">Adicionar Novo</h2>
           <div className="bg-white p-6 rounded-lg border">
             <PopupForm onSubmit={() => {}} isSubmitting={false} />
           </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Popups Existentes</h2>
          <div className="space-y-4">
            {isLoading ? <p>Carregando...</p> : popups?.map(popup => (
                <Card key={popup.id} className={popup.is_active ? "border-green-500 border-2" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex justify-between items-center text-lg">
                            {popup.title}
                            {popup.is_active && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Ativo</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 pb-2">
                        {popup.content}
                    </CardContent>
                    <CardFooter className="flex justify-between pt-0">
                        <Button 
                            variant="link" 
                            className="p-0 h-auto text-blue-600"
                            onClick={() => toggleActiveMutation.mutate({ id: popup.id, currentState: popup.is_active })}
                        >
                            {popup.is_active ? "Desativar" : "Ativar este Popup"}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => { if(confirm("Excluir?")) deleteMutation.mutate(popup.id); }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopupsPage;
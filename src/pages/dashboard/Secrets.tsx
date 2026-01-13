"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Save, Trash2, Plus, Lock, Eye, EyeOff, Loader2, Search, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppSetting {
  id: number;
  key: string;
  value: string | null;
}

const SecretsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSecret, setNewSecret] = useState({ key: "", value: "" });

  const { data: settings, isLoading } = useQuery<AppSetting[]>({
    queryKey: ["allAppSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data;
    },
  });

  // Query para verificar status do Mercado Pago
  const { data: mpProdStatus } = useQuery({
    queryKey: ["mp-prod-check"],
    queryFn: async () => {
        const { data } = await supabase.functions.invoke("get-mercadopago-status", { body: { type: 'production' } });
        return data?.connected || false;
    },
    enabled: !!settings?.find(s => s.key === 'mercadopago_access_token')?.value
  });

  const { data: mpTestStatus } = useQuery({
    queryKey: ["mp-test-check"],
    queryFn: async () => {
        const { data } = await supabase.functions.invoke("get-mercadopago-status", { body: { type: 'test' } });
        return data?.connected || false;
    },
    enabled: !!settings?.find(s => s.key === 'mercadopago_test_access_token')?.value
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allAppSettings"] });
      queryClient.invalidateQueries({ queryKey: ["mp-prod-check"] });
      queryClient.invalidateQueries({ queryKey: ["mp-test-check"] });
      showSuccess("Configuração salva com sucesso!");
      setIsAddModalOpen(false);
      setNewSecret({ key: "", value: "" });
    },
    onError: (err: any) => showError(`Erro ao salvar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("app_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allAppSettings"] });
      showSuccess("Configuração removida.");
    },
    onError: (err: any) => showError(`Erro ao remover: ${err.message}`),
  });

  const toggleValueVisibility = (id: number) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (key: string, value: string | null) => {
    if (!value) return <Badge variant="outline" className="text-gray-400">Vazio</Badge>;

    // Validação específica para Mercado Pago
    if (key === 'mercadopago_access_token') {
        if (mpProdStatus === true) return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Validado</Badge>;
        if (mpProdStatus === false) return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Token Inválido</Badge>;
        return <Badge variant="secondary" className="animate-pulse">Validando...</Badge>;
    }

    if (key === 'mercadopago_test_access_token') {
        if (mpTestStatus === true) return <Badge className="bg-blue-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Teste Ativo</Badge>;
        if (mpTestStatus === false) return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Token Inválido</Badge>;
        return <Badge variant="secondary" className="animate-pulse">Validando...</Badge>;
    }

    // Status geral para chaves preenchidas
    return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Preenchido</Badge>;
  };

  const filteredSettings = settings?.filter((s) =>
    s.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lock className="h-8 w-8 text-primary" /> Gerenciador de Secrets
          </h1>
          <p className="text-muted-foreground text-sm">Controle de chaves de API e status de integração.</p>
        </div>

        <div className="flex items-center gap-2">
            <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Filtrar por nome..." 
                    className="pl-8 h-9" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                    <Button className="h-9">
                        <Plus className="w-4 h-4 mr-2" /> Nova Secret
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Nova Configuração</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Identificador (Key)</Label>
                            <Input 
                                placeholder="ex: mercadopago_access_token" 
                                value={newSecret.key}
                                onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor (Value)</Label>
                            <Input 
                                placeholder="Insira o segredo aqui" 
                                value={newSecret.value}
                                onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={() => upsertMutation.mutate(newSecret)}
                            disabled={!newSecret.key || !newSecret.value || upsertMutation.isPending}
                        >
                            {upsertMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-1/4">Chave</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="w-40 text-center">Status</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
            ) : filteredSettings?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">Nenhuma chave encontrada.</TableCell></TableRow>
            ) : filteredSettings?.map((setting) => (
                <TableRow key={setting.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-mono font-bold text-sm text-primary">
                        {setting.key}
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    type={showValues[setting.id] ? "text" : "password"}
                                    defaultValue={setting.value || ""}
                                    className="h-8 font-mono text-xs bg-gray-50 pr-8"
                                    onBlur={(e) => {
                                        if (e.target.value !== setting.value) {
                                            upsertMutation.mutate({ key: setting.key, value: e.target.value });
                                        }
                                    }}
                                />
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 absolute right-1 top-1 text-muted-foreground hover:bg-transparent"
                                    onClick={() => toggleValueVisibility(setting.id)}
                                >
                                    {showValues[setting.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        {getStatusBadge(setting.key, setting.value)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => {
                                if(confirm(`Tem certeza que deseja apagar a chave "${setting.key}"?`)) {
                                    deleteMutation.mutate(setting.id);
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SecretsPage;
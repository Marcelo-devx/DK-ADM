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
import { Key, Save, Trash2, Plus, Lock, Eye, EyeOff, Loader2, Search, CheckCircle2, AlertCircle, Zap, ShieldCheck, Beaker } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

  const currentMode = settings?.find(s => s.key === 'payment_mode')?.value || 'test';

  // Validações de Status
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

  const { data: psProdStatus } = useQuery({
    queryKey: ["ps-prod-check"],
    queryFn: async () => {
        const { data } = await supabase.functions.invoke("get-pagseguro-status", { body: { type: 'production' } });
        return data?.connected || false;
    },
    enabled: !!settings?.find(s => s.key === 'pagseguro_token')?.value
  });

  const { data: psTestStatus } = useQuery({
    queryKey: ["ps-test-check"],
    queryFn: async () => {
        const { data } = await supabase.functions.invoke("get-pagseguro-status", { body: { type: 'test' } });
        return data?.connected || false;
    },
    enabled: !!settings?.find(s => s.key === 'pagseguro_test_token')?.value
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
      showSuccess("Configuração atualizada!");
      setIsAddModalOpen(false);
      setNewSecret({ key: "", value: "" });
    },
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("app_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allAppSettings"] });
      showSuccess("Removido.");
    },
  });

  const toggleValueVisibility = (id: number) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (key: string, value: string | null) => {
    if (!value) return <Badge variant="outline" className="text-gray-400">Pendente</Badge>;

    if (key === 'mercadopago_access_token') {
        if (mpProdStatus === true) return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Produção OK</Badge>;
        if (mpProdStatus === false) return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Erro Chave</Badge>;
        return <Badge variant="secondary">Verificando...</Badge>;
    }
    if (key === 'mercadopago_test_access_token') {
        if (mpTestStatus === true) return <Badge className="bg-blue-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Teste OK</Badge>;
        if (mpTestStatus === false) return <Badge variant="destructive">Erro Teste</Badge>;
        return <Badge variant="secondary">Verificando...</Badge>;
    }
    if (key === 'pagseguro_token') {
        if (psProdStatus === true) return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Produção OK</Badge>;
        if (psProdStatus === false) return <Badge variant="destructive">Erro Chave</Badge>;
        return <Badge variant="secondary">Verificando...</Badge>;
    }
    if (key === 'pagseguro_test_token') {
        if (psTestStatus === true) return <Badge className="bg-blue-500 gap-1"><CheckCircle2 className="w-3 h-3" /> Teste OK</Badge>;
        if (psTestStatus === false) return <Badge variant="destructive">Erro Teste</Badge>;
        return <Badge variant="secondary">Verificando...</Badge>;
    }

    return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 font-bold">Preenchido</Badge>;
  };

  const filteredSettings = settings?.filter((s) =>
    s.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lock className="h-8 w-8 text-primary" /> Secrets & Gateways
          </h1>
          <p className="text-muted-foreground text-sm">Gerenciamento de chaves reais e modo de teste (homologação).</p>
        </div>

        <div className="flex items-center gap-3">
            <Card className={currentMode === 'production' ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
                <CardContent className="p-2 px-4 flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-gray-500">Ambiente Atual</span>
                        <span className={`text-sm font-black uppercase ${currentMode === 'production' ? 'text-red-600' : 'text-blue-600'}`}>
                            {currentMode === 'production' ? 'PRODUÇÃO (LIVE)' : 'HOMOLOGAÇÃO (TEST)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentMode === 'test' ? <Beaker className="w-4 h-4 text-blue-500" /> : <ShieldCheck className="w-4 h-4 text-red-500" />}
                        <Switch 
                            checked={currentMode === 'production'} 
                            onCheckedChange={(val) => upsertMutation.mutate({ key: 'payment_mode', value: val ? 'production' : 'test' })}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50" onClick={() => setIsAddModalOpen(true)}>
             <Plus className="w-6 h-6 text-primary" />
             <span className="text-xs font-bold text-primary uppercase">Adicionar Outra Secret</span>
          </div>
          <div className="relative md:col-span-3">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Pesquisar por identificador de chave..." 
                className="pl-10 h-full min-h-[50px] bg-white border-2" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-1/4">Chave de Integração</TableHead>
              <TableHead>Valor / Secret</TableHead>
              <TableHead className="w-40 text-center">Validação</TableHead>
              <TableHead className="w-[80px] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
            ) : filteredSettings?.map((setting) => (
                <TableRow key={setting.id} className={cn("hover:bg-gray-50/50", setting.key === 'payment_mode' && "bg-muted/30")}>
                    <TableCell className="font-mono font-bold text-sm">
                        <div className="flex items-center gap-2">
                            {setting.key.includes('test') ? <Beaker className="w-3 h-3 text-blue-400" /> : <ShieldCheck className="w-3 h-3 text-green-400" />}
                            <span className={setting.key.includes('test') ? "text-blue-700" : "text-primary"}>
                                {setting.key}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    type={showValues[setting.id] ? "text" : "password"}
                                    defaultValue={setting.value || ""}
                                    className="h-8 font-mono text-xs bg-gray-50 pr-8 border-dashed"
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

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Nova Configuração Global</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold">Chave Sugerida</Label>
                    <div className="flex flex-wrap gap-2">
                        {['mercadopago_access_token', 'pagseguro_token', 'pagseguro_email', 'n8n_webhook_url'].map(k => (
                            <Badge key={k} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-white" onClick={() => setNewSecret({ ...newSecret, key: k })}>
                                {k}
                            </Badge>
                        ))}
                    </div>
                </div>
                <div className="space-y-2 pt-2">
                    <Label>Identificador (Key)</Label>
                    <Input 
                        placeholder="ex: token_servico_xyz" 
                        value={newSecret.key}
                        onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Valor do Segredo</Label>
                    <Input 
                        placeholder="Cole o valor aqui" 
                        value={newSecret.value}
                        onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button onClick={() => upsertMutation.mutate(newSecret)} disabled={!newSecret.key || !newSecret.value}>Salvar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecretsPage;
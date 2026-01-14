"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key, Webhook, Plus, Trash2, Globe, Database } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

const N8nIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("order_created");
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  const apiEndpoints = [
    { method: "POST", name: "Receber Pedido", url: `${baseUrl}/n8n-receive-order`, desc: "Cria um novo pedido (checkout)." },
    { method: "POST", name: "Listar Produtos", url: `${baseUrl}/n8n-list-products`, desc: "Retorna catálogo com variações." },
    { method: "POST", name: "Listar Clientes", url: `${baseUrl}/n8n-list-clients`, desc: "Retorna todos os clientes." },
    { method: "POST", name: "Criar Cliente", url: `${baseUrl}/n8n-create-client`, desc: "Cadastra novo usuário." },
  ];

  // --- Queries ---
  const { data: settings } = useQuery({
    queryKey: ["n8nSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "n8n_integration_token").single();
      return data;
    },
  });

  const { data: webhooks, isLoading: isLoadingWebhooks } = useQuery({
    queryKey: ["webhookConfigs"],
    queryFn: async () => {
        const { data, error } = await supabase.from("webhook_configs").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    }
  });

  useEffect(() => {
    if (settings?.value) {
      setToken(settings.value);
    }
  }, [settings]);

  // --- Mutations ---
  const saveTokenMutation = useMutation({
    mutationFn: async () => {
      if (token.length < 8) throw new Error("O token deve ter pelo menos 8 caracteres.");
      const { error } = await supabase.from("app_settings").upsert({ key: "n8n_integration_token", value: token }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8nSettings"] });
      showSuccess("Token salvo!");
    },
    onError: (err: any) => showError(err.message),
  });

  const addWebhookMutation = useMutation({
    mutationFn: async () => {
        if (!webhookUrl) throw new Error("URL é obrigatória.");
        const { error } = await supabase.from("webhook_configs").insert({
            trigger_event: selectedEvent,
            target_url: webhookUrl,
            is_active: true
        });
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] });
        showSuccess("Webhook adicionado!");
        setWebhookUrl("");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
        const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] });
        showSuccess("Webhook removido.");
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: boolean }) => {
        const { error } = await supabase.from("webhook_configs").update({ is_active: status }).eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] }),
  });

  // --- Helpers ---
  const generateToken = () => setToken("n8n_" + Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase());
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showSuccess("Copiado!"); };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Workflow className="h-8 w-8 text-orange-600" /> Automação & API
        </h1>
        <p className="text-muted-foreground">Conecte seu sistema ao N8n, Typebot ou qualquer ferramenta externa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Credenciais */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="border-orange-200 shadow-md">
                <CardHeader className="bg-orange-50/30 border-b pb-4">
                    <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-orange-600" /> Acesso API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label>Token Bearer</Label><Button variant="link" size="sm" className="h-auto p-0 text-orange-600" onClick={generateToken}>Gerar Novo</Button></div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono pr-10" />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(token)}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    <Button onClick={() => saveTokenMutation.mutate()} disabled={saveTokenMutation.isPending || !token} className="w-full bg-orange-600 hover:bg-orange-700 font-bold">{saveTokenMutation.isPending ? "Salvando..." : <><Save className="w-4 h-4 mr-2" /> Salvar Token</>}</Button>
                </CardContent>
            </Card>

            <Alert className="bg-blue-50 border-blue-200">
                <Check className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-bold">Autenticação</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs">Todos os endpoints exigem o header: <br/><code>Authorization: Bearer SEU_TOKEN</code></AlertDescription>
            </Alert>
        </div>

        {/* Coluna Direita: Tabs (Docs e Webhooks) */}
        <div className="lg:col-span-2">
            <Tabs defaultValue="endpoints">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="endpoints"><Globe className="w-4 h-4 mr-2" /> Endpoints API</TabsTrigger>
                    <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Configurar Webhooks</TabsTrigger>
                </TabsList>

                {/* ABA ENDPOINTS */}
                <TabsContent value="endpoints">
                    <Card>
                        <CardHeader><CardTitle>Endpoints Disponíveis</CardTitle><CardDescription>Use estas URLs no nó "HTTP Request" do N8n/Typebot.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            {apiEndpoints.map((ep, i) => (
                                <div key={i} className="border rounded-lg p-3 bg-gray-50 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">{ep.method}</Badge>
                                            <span className="font-bold text-sm">{ep.name}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(ep.url)}><Copy className="w-3 h-3" /></Button>
                                    </div>
                                    <div className="bg-white border rounded px-2 py-1 text-xs font-mono text-gray-600 truncate">{ep.url}</div>
                                    <p className="text-xs text-gray-500 italic">{ep.desc}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA WEBHOOKS */}
                <TabsContent value="webhooks">
                    <Card>
                        <CardHeader><CardTitle>Gatilhos Ativos</CardTitle><CardDescription>Quando um evento ocorre, notificaremos estas URLs (POST).</CardDescription></CardHeader>
                        <CardContent className="space-y-6">
                            {/* Form de Adição */}
                            <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-dashed">
                                <Label className="text-xs font-bold uppercase text-gray-500">Adicionar Novo Webhook</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                                        <SelectTrigger className="w-[180px] bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="order_created">Pedido Criado</SelectItem>
                                            <SelectItem value="payment_confirmed">Pagamento Confirmado</SelectItem>
                                            <SelectItem value="abandoned_cart">Carrinho Abandonado (Monitor)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input placeholder="https://seu-n8n.com/webhook/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-white" />
                                    <Button onClick={() => addWebhookMutation.mutate()} disabled={addWebhookMutation.isPending}><Plus className="w-4 h-4" /></Button>
                                </div>
                            </div>

                            {/* Lista */}
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>URL de Destino</TableHead><TableHead className="w-12">Ativo</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {isLoadingWebhooks ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-4">Carregando...</TableCell></TableRow>
                                        ) : webhooks && webhooks.length > 0 ? (
                                            webhooks.map((hook) => (
                                                <TableRow key={hook.id}>
                                                    <TableCell><Badge variant="secondary">{hook.trigger_event}</Badge></TableCell>
                                                    <TableCell className="font-mono text-xs max-w-[200px] truncate" title={hook.target_url}>{hook.target_url}</TableCell>
                                                    <TableCell>
                                                        <Switch checked={hook.is_active} onCheckedChange={(val) => toggleWebhookMutation.mutate({ id: hook.id, status: val })} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => deleteWebhookMutation.mutate(hook.id)}><Trash2 className="w-4 h-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum webhook configurado.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
};

export default N8nIntegrationPage;
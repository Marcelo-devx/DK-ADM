"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key, Webhook, Plus, Trash2, Globe, ChevronDown, ChevronRight, FileJson, Zap, Loader2, Pencil, X } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

const N8nIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("order_created");
  const [openEndpoints, setOpenEndpoints] = useState<number[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);
  
  // Estados para edição inline
  const [editingWebhookId, setEditingWebhookId] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState("");
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  // --- Documentação dos Payloads ---
  const apiDocs = [
    { 
      method: "WEBHOOK", 
      name: "Eventos de Produto (Novo)", 
      url: "Seu Endpoint N8N (Configurar na aba Webhooks)", 
      desc: "Disparado automaticamente quando um produto é criado, alterado ou excluído.",
      request: `{
  "event": "product_created", // ou "product_updated", "product_deleted"
  "timestamp": "2024-03-20T10:00:00Z",
  "data": {
    "id": 10,
    "name": "Essência Zomo",
    "price": 15.90,
    "stock_quantity": 100,
    "is_visible": true,
    ...outros_campos
  }
}`,
      response: `200 OK`
    },
    { 
      method: "WEBHOOK", 
      name: "Pedido Criado (Enriquecido)", 
      url: "Seu Endpoint N8N", 
      desc: "Enviado quando uma venda entra no sistema. Inclui dados do cliente.",
      request: `{
  "event": "order_created",
  "timestamp": "...",
  "data": {
    "id": 5050,
    "total_price": 150.00,
    "status": "Pendente",
    "customer": {
       "full_name": "João Silva",
       "phone": "11999999999",
       "email": "joao@email.com"
    },
    ...dados_do_pedido
  }
}`,
      response: `200 OK`
    },
    { 
      method: "POST", 
      name: "Listar Produtos", 
      url: `${baseUrl}/n8n-list-products`, 
      desc: "Retorna o catálogo completo, incluindo variações (sabores, tamanhos).",
      request: null,
      response: `[ ... lista de produtos ... ]`
    },
    { 
        method: "POST", 
        name: "Listar Clientes", 
        url: `${baseUrl}/n8n-list-clients`, 
        desc: "Lista todos os clientes cadastrados com pontos e estatísticas.",
        request: null,
        response: `[ ... lista de clientes ... ]` 
      },
    { 
      method: "POST", 
      name: "Criar Cliente", 
      url: `${baseUrl}/n8n-create-client`, 
      desc: "Cadastra um novo usuário no sistema (Auth + Profile).",
      request: `{ "email": "...", "name": "...", "phone": "..." }`,
      response: `{ "success": true, "id": "..." }`
    },
    { 
        method: "POST", 
        name: "Receber Pedido (Checkout)", 
        url: `${baseUrl}/n8n-receive-order`, 
        desc: "Cria um pedido completo e gera o pagamento.",
        request: `{ "email": "...", "products": [...] }`,
        response: `{ "success": true, "order_id": ... }`
      },
      { 
        method: "WEBHOOK", 
        name: "Campanha de Retenção", 
        url: "Seu Endpoint N8N", 
        desc: "Disparo manual via painel de Clientes (Recuperação).",
        request: `{ "event": "retention_campaign", "recipients": [...] }`,
        response: `200 OK`
      },
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

  const updateWebhookUrlMutation = useMutation({
    mutationFn: async ({ id, url }: { id: number, url: string }) => {
        if (!url) throw new Error("URL não pode ficar vazia.");
        const { error } = await supabase.from("webhook_configs").update({ target_url: url }).eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] });
        showSuccess("URL atualizada!");
        setEditingWebhookId(null);
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

  const testWebhookMutation = useMutation({
    mutationFn: async ({ id, url, event }: { id: number, url: string, event: string }) => {
        setTestingId(id);
        const { data, error } = await supabase.functions.invoke("test-webhook-endpoint", {
            body: { url, event_type: event }
        });
        
        if (error) throw error;
        return data;
    },
    onSuccess: (data) => {
        if (data.success) {
            showSuccess(`Sucesso! Status: ${data.status}`);
        } else {
            // Mostra o erro retornado pelo N8N
            toast.error(`Falha: ${data.error}`, {
                description: `Código: ${data.status}. Resposta: ${JSON.stringify(data.remote_response).substring(0, 50)}...`
            });
        }
        setTestingId(null);
    },
    onError: (err: any) => {
        showError(`Erro ao testar: ${err.message}`);
        setTestingId(null);
    }
  });

  // --- Helpers ---
  const generateToken = () => setToken("n8n_" + Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase());
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showSuccess("Copiado!"); };
  
  const toggleEndpoint = (index: number) => {
    setOpenEndpoints(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const startEditing = (hook: any) => {
    setEditingWebhookId(hook.id);
    setTempUrl(hook.target_url);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Workflow className="h-8 w-8 text-orange-600" /> Automação & API
        </h1>
        <p className="text-muted-foreground">Documentação técnica e configuração de integração com N8n/Typebot.</p>
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
                <AlertDescription className="text-blue-700 text-xs">Todos os endpoints exigem o header: <br/><code className="bg-blue-100 px-1 rounded">Authorization: Bearer SEU_TOKEN</code></AlertDescription>
            </Alert>
        </div>

        {/* Coluna Direita: Tabs (Docs e Webhooks) */}
        <div className="lg:col-span-2">
            <Tabs defaultValue="webhooks">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="endpoints"><Globe className="w-4 h-4 mr-2" /> Swagger / Docs</TabsTrigger>
                    <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Webhooks</TabsTrigger>
                </TabsList>

                {/* ABA ENDPOINTS (Estilo Swagger) */}
                <TabsContent value="endpoints">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Endpoints Disponíveis</CardTitle>
                            <CardDescription>Clique para expandir e ver o Schema (JSON) de envio e resposta.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {apiDocs.map((ep, i) => (
                                <Collapsible 
                                    key={i} 
                                    open={openEndpoints.includes(i)}
                                    onOpenChange={() => toggleEndpoint(i)}
                                    className="border rounded-lg overflow-hidden bg-white shadow-sm"
                                >
                                    <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors" onClick={() => toggleEndpoint(i)}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Badge className={`uppercase w-20 justify-center ${ep.method === 'GET' ? 'bg-blue-600' : ep.method === 'WEBHOOK' ? 'bg-purple-600' : 'bg-emerald-600'}`}>{ep.method}</Badge>
                                            <span className="font-semibold text-sm truncate">{ep.url.replace(baseUrl, '')}</span>
                                            <span className="text-xs text-muted-foreground hidden sm:inline-block">- {ep.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground hidden sm:block">{ep.desc.substring(0, 40)}...</span>
                                            {openEndpoints.includes(i) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                        </div>
                                    </div>

                                    <CollapsibleContent>
                                        <div className="p-4 bg-slate-50 border-t space-y-4">
                                            <p className="text-sm text-gray-600 mb-2">{ep.desc}</p>
                                            
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-mono bg-white border px-2 py-1 rounded text-gray-600 w-full truncate select-all">{ep.url}</span>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(ep.url); }}><Copy className="w-3 h-3" /></Button>
                                            </div>

                                            {ep.request && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs font-bold text-gray-700">
                                                            {ep.method === 'WEBHOOK' ? "Payload Enviado (Webhook Body)" : "Request Body (JSON)"}
                                                        </Label>
                                                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(ep.request!)}>Copiar</Button>
                                                    </div>
                                                    <div className="bg-slate-900 text-slate-50 p-3 rounded-md font-mono text-xs overflow-x-auto">
                                                        <pre>{ep.request}</pre>
                                                    </div>
                                                </div>
                                            )}

                                            {ep.response && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs font-bold text-gray-700">Response Example</Label>
                                                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(ep.response!)}>Copiar</Button>
                                                    </div>
                                                    <div className="bg-slate-800 text-green-400 p-3 rounded-md font-mono text-xs overflow-x-auto">
                                                        <pre>{ep.response}</pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
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
                                        <SelectTrigger className="w-[250px] bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="order_created">Pedido Criado</SelectItem>
                                            <SelectItem value="payment_confirmed">Pagamento Confirmado</SelectItem>
                                            <SelectItem value="product_created">Produto Criado</SelectItem>
                                            <SelectItem value="product_updated">Produto Atualizado</SelectItem>
                                            <SelectItem value="product_deleted">Produto Excluído</SelectItem>
                                            <SelectItem value="retention_campaign">Campanha de Retenção</SelectItem>
                                            <SelectItem value="abandoned_cart">Carrinho Abandonado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input placeholder="https://seu-n8n.com/webhook/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-white" />
                                    <Button onClick={() => addWebhookMutation.mutate()} disabled={addWebhookMutation.isPending}><Plus className="w-4 h-4" /></Button>
                                </div>
                            </div>

                            {/* Lista */}
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>URL de Destino</TableHead><TableHead className="w-12 text-center">Teste</TableHead><TableHead className="w-12">Ativo</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {isLoadingWebhooks ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-4">Carregando...</TableCell></TableRow>
                                        ) : webhooks && webhooks.length > 0 ? (
                                            webhooks.map((hook) => (
                                                <TableRow key={hook.id}>
                                                    <TableCell><Badge variant="secondary">{hook.trigger_event}</Badge></TableCell>
                                                    
                                                    {/* CÉLULA DE URL EDITÁVEL */}
                                                    <TableCell>
                                                        {editingWebhookId === hook.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input 
                                                                    value={tempUrl} 
                                                                    onChange={(e) => setTempUrl(e.target.value)} 
                                                                    className="h-8 text-xs font-mono"
                                                                    autoFocus
                                                                />
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    onClick={() => updateWebhookUrlMutation.mutate({ id: hook.id, url: tempUrl })}
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </Button>
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => setEditingWebhookId(null)}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between group">
                                                                <span className="font-mono text-xs max-w-[250px] truncate" title={hook.target_url}>
                                                                    {hook.target_url}
                                                                </span>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500"
                                                                    onClick={() => startEditing(hook)}
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-center">
                                                        <Button 
                                                            variant="secondary" 
                                                            size="icon" 
                                                            className="h-8 w-8 bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200 border"
                                                            onClick={() => testWebhookMutation.mutate({ id: hook.id, url: hook.target_url, event: hook.trigger_event })}
                                                            disabled={testWebhookMutation.isPending}
                                                            title="Enviar dados de teste"
                                                        >
                                                            {testingId === hook.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch checked={hook.is_active} onCheckedChange={(val) => toggleWebhookMutation.mutate({ id: hook.id, status: val })} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => deleteWebhookMutation.mutate(hook.id)}><Trash2 className="w-4 h-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum webhook configurado.</TableCell></TableRow>
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
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key, Webhook, Plus, Trash2, Globe, ChevronDown, ChevronRight, FileJson, Zap, Loader2, Pencil, X, ArrowUpRight, ArrowDownLeft } from "lucide-react";
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
  const [openEndpoints, setOpenEndpoints] = useState<string[]>([]); // Mudado para string para suportar IDs únicos
  const [testingId, setTestingId] = useState<number | null>(null);
  
  // Estados para edição inline
  const [editingWebhookId, setEditingWebhookId] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState("");
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  // --- Documentação Organizada ---
  const webhookEvents = [
    { 
      id: "wh_order",
      name: "Pedido Criado (V2)", 
      desc: "Enviado automaticamente quando uma nova venda entra no sistema.",
      payload: `{
  "event": "order_created",
  "timestamp": "2024-03-20T10:00:00.000Z",
  "data": {
    "id": 5050,
    "status": "Pendente",
    "created_at_br": "20/03/2024 07:00:00",
    "final_total_value": 170.00,
    "customer": {
       "full_name": "João Silva",
       "phone": "11999999999",
       "email": "joao@email.com"
    },
    "shipping_address": {
       "street": "Rua Exemplo",
       "number": "100",
       "neighborhood": "Centro"
    },
    "financial_breakdown": {
       "products_subtotal": 150.00,
       "shipping_cost": 20.00,
       "total_paid": 170.00
    }
  }
}`
    },
    { 
      id: "wh_product",
      name: "Atualizações de Produto", 
      desc: "Disparado quando um produto é criado, alterado ou excluído.",
      payload: `{
  "event": "product_updated",
  "timestamp": "2024-03-20T10:00:00Z",
  "data": {
    "id": 10,
    "name": "Essência Zomo",
    "price": 15.90,
    "stock_quantity": 99,
    "is_visible": true
  }
}`
    },
    { 
        id: "wh_retention",
        name: "Campanha de Retenção", 
        desc: "Disparo manual via painel de Clientes para recuperação.",
        payload: `{
  "event": "retention_campaign",
  "campaign_size": 1,
  "recipients": [
    {
      "client_id": "uuid-...",
      "name": "Maria",
      "phone": "11999999999",
      "message_content": "Oi Maria! Volte para a loja..."
    }
  ]
}`
      },
  ];

  const apiActions = [
    { 
      id: "api_list_products",
      method: "POST", 
      path: "/n8n-list-products", 
      desc: "Retorna o catálogo completo, incluindo variações (sabores, tamanhos).",
      body: `{}`,
      response: `[ { "id": 1, "name": "Produto A", "options": [...] } ]`
    },
    { 
      id: "api_list_clients",
      method: "POST", 
      path: "/n8n-list-clients", 
      desc: "Lista todos os clientes cadastrados com pontos e estatísticas.",
      body: `{}`,
      response: `[ { "id": "uuid", "name": "João", "points": 150 } ]` 
    },
    { 
      id: "api_create_client",
      method: "POST", 
      path: "/n8n-create-client", 
      desc: "Cadastra um novo usuário no sistema (Auth + Profile).",
      body: `{ 
  "email": "novo@email.com", 
  "name": "Nome Completo", 
  "phone": "11999999999" 
}`,
      response: `{ "success": true, "id": "uuid-novo" }`
    },
    { 
      id: "api_receive_order",
      method: "POST", 
      path: "/n8n-receive-order", 
      desc: "Cria um pedido completo e gera o pagamento (Pix).",
      body: `{ 
  "customer": { "phone": "11999999999", "name": "João" },
  "items": [
    { "sku": "PROD-001", "quantity": 2 }
  ],
  "payment_method": "pix"
}`,
      response: `{ "success": true, "order_id": 123, "payment_info": { ... } }`
    }
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

  // --- Mutations (Mantidas iguais) ---
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
  
  const toggleEndpoint = (id: string) => {
    setOpenEndpoints(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
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
          <Workflow className="h-8 w-8 text-orange-600" /> Automação (N8n / Typebot)
        </h1>
        <p className="text-muted-foreground">Documentação técnica e configuração de eventos.</p>
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
                <AlertDescription className="text-blue-700 text-xs">Todos os endpoints exigem o header: <br/><code className="bg-blue-100 px-1 rounded block mt-1 p-1">Authorization: Bearer SEU_TOKEN</code></AlertDescription>
            </Alert>
        </div>

        {/* Coluna Direita: Tabs (Docs e Webhooks) */}
        <div className="lg:col-span-2">
            <Tabs defaultValue="webhooks">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="endpoints"><Globe className="w-4 h-4 mr-2" /> Swagger / Docs</TabsTrigger>
                    <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Meus Webhooks</TabsTrigger>
                </TabsList>

                {/* ABA ENDPOINTS (SWAGGER MELHORADO) */}
                <TabsContent value="endpoints">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Documentação Técnica</CardTitle>
                            <CardDescription>Referência completa de eventos e ações disponíveis.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            
                            {/* SEÇÃO 1: GATILHOS / WEBHOOKS (SAÍDA) */}
                            <div>
                                <h3 className="text-sm font-black uppercase text-purple-600 mb-3 flex items-center gap-2">
                                    <ArrowUpRight className="w-4 h-4" /> Gatilhos (Sistema &rarr; N8N)
                                </h3>
                                <div className="space-y-3">
                                    {webhookEvents.map((evt) => (
                                        <Collapsible 
                                            key={evt.id} 
                                            open={openEndpoints.includes(evt.id)}
                                            onOpenChange={() => toggleEndpoint(evt.id)}
                                            className="border rounded-lg overflow-hidden bg-white shadow-sm"
                                        >
                                            <div className="flex items-center justify-between p-3 bg-purple-50/50 hover:bg-purple-50 cursor-pointer transition-colors" onClick={() => toggleEndpoint(evt.id)}>
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Badge className="bg-purple-600 hover:bg-purple-700 w-24 justify-center">WEBHOOK</Badge>
                                                    <span className="font-semibold text-sm truncate">{evt.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground hidden sm:block">{evt.desc.substring(0, 40)}...</span>
                                                    {openEndpoints.includes(evt.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                                </div>
                                            </div>

                                            <CollapsibleContent>
                                                <div className="p-4 bg-slate-50 border-t space-y-3">
                                                    <p className="text-sm text-gray-600">{evt.desc}</p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center">
                                                            <Label className="text-xs font-bold text-gray-700">Payload Exemplo (Body JSON)</Label>
                                                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(evt.payload)}>Copiar</Button>
                                                        </div>
                                                        <div className="bg-slate-900 text-slate-50 p-3 rounded-md font-mono text-xs overflow-x-auto border border-slate-700">
                                                            <pre>{evt.payload}</pre>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </div>

                            {/* SEÇÃO 2: API (ENTRADA) */}
                            <div>
                                <h3 className="text-sm font-black uppercase text-emerald-600 mb-3 flex items-center gap-2">
                                    <ArrowDownLeft className="w-4 h-4" /> API (N8N &rarr; Sistema)
                                </h3>
                                <div className="space-y-3">
                                    {apiActions.map((api) => (
                                        <Collapsible 
                                            key={api.id} 
                                            open={openEndpoints.includes(api.id)}
                                            onOpenChange={() => toggleEndpoint(api.id)}
                                            className="border rounded-lg overflow-hidden bg-white shadow-sm"
                                        >
                                            <div className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition-colors" onClick={() => toggleEndpoint(api.id)}>
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Badge className="bg-emerald-600 hover:bg-emerald-700 w-24 justify-center">POST</Badge>
                                                    <span className="font-mono text-xs font-bold text-slate-700 truncate">{api.path}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {openEndpoints.includes(api.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                                </div>
                                            </div>

                                            <CollapsibleContent>
                                                <div className="p-4 bg-slate-50 border-t space-y-4">
                                                    <p className="text-sm text-gray-600">{api.desc}</p>
                                                    
                                                    <div className="flex items-center gap-2 bg-white border p-2 rounded">
                                                        <span className="text-xs font-mono text-gray-600 select-all flex-1">{baseUrl}{api.path}</span>
                                                        <Button variant="ghost" size="sm" className="h-6" onClick={() => copyToClipboard(baseUrl + api.path)}><Copy className="w-3 h-3" /></Button>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs font-bold text-gray-700">Body (Requisição)</Label>
                                                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => copyToClipboard(api.body)}>Copiar</Button>
                                                            </div>
                                                            <div className="bg-slate-900 text-yellow-300 p-3 rounded-md font-mono text-xs overflow-x-auto h-32 border border-slate-700">
                                                                <pre>{api.body}</pre>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs font-bold text-gray-700">Exemplo de Resposta</Label>
                                                            </div>
                                                            <div className="bg-slate-900 text-green-400 p-3 rounded-md font-mono text-xs overflow-x-auto h-32 border border-slate-700">
                                                                <pre>{api.response}</pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA WEBHOOKS (CONFIGURAÇÃO) */}
                <TabsContent value="webhooks">
                    <Card>
                        <CardHeader><CardTitle>Configuração de Gatilhos</CardTitle><CardDescription>Defina para onde enviar os dados quando um evento ocorrer.</CardDescription></CardHeader>
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
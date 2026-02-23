"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key, Webhook, Plus, Trash2, Globe, ChevronDown, ChevronRight, Zap, Loader2, Pencil, X, ArrowUpRight, ArrowDownLeft, Network, FileJson, Play } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
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
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const N8nIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("order_created");
  const [openEndpoints, setOpenEndpoints] = useState<string[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);
  
  const [editingWebhookId, setEditingWebhookId] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState("");
  
  // Estado para Diagnóstico
  const [diagnosticUrl, setDiagnosticUrl] = useState("https://n8n-ws.dkcwb.cloud/webhook/testar-conexão");
  
  // Estado para Modal de Documentação
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Estados para Modal de Teste/Simulação
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testItem, setTestItem] = useState<any>(null);
  const [testTargetUrl, setTestTargetUrl] = useState("");
  const [testRequestBody, setTestRequestBody] = useState("");
  const [testResponse, setTestResponse] = useState<any>(null);
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  const webhookEvents = [
    { 
      id: "wh_order",
      event_key: "order_created",
      name: "Pedido Finalizado (Checkout)", 
      type: "webhook",
      desc: "Enviado quando uma venda é concluída. Inclui o valor do frete calculado e o total pago.",
      payload: `{
  "event": "order_created",
  "timestamp": "2024-03-20T10:00:00.000Z",
  "data": {
    "id": 5050,
    "status": "Pendente",
    "payment_method": "Pix",
    "shipping_cost": 15.00,
    "final_total_value": 185.00,
    "financial_breakdown": {
        "products_subtotal": 170.00,
        "shipping_cost": 15.00,
        "total_paid": 185.00
    },
    "customer": {
       "full_name": "João Silva",
       "phone": "5511999999999",
       "email": "joao@email.com"
    },
    "shipping_address": {
       "neighborhood": "Centro",
       "city": "Curitiba"
    },
    "items": [
        { "name": "Pod Zomo", "quantity": 2, "price": 85.00 }
    ]
  }
}`
    },
    { 
      id: "wh_support",
      event_key: "support_request",
      name: "Solicitação de Suporte", 
      type: "webhook",
      desc: "Disparado quando o cliente solicita ajuda.",
      payload: `{
  "event": "support_request",
  "timestamp": "2024-03-20T10:05:00Z",
  "data": {
    "user_id": "uuid-cliente",
    "customer_name": "Maria Souza",
    "phone": "5511988888888",
    "reason": "Dúvida sobre entrega"
  }
}`
    }
  ];

  const apiActions = [
    { 
      id: "api_create_client",
      name: "Criar Cliente",
      method: "POST", 
      path: "/n8n-create-client", 
      type: "api",
      desc: "Cria ou recupera um cliente (Idempotente: não duplica).",
      body: `{ "email": "teste@exemplo.com", "name": "Teste", "phone": "11999999999" }`,
      response: `{ "success": true, "id": "uuid", "is_new_user": false }`
    },
    { 
      id: "api_receive_order",
      name: "Receber Pedido",
      method: "POST", 
      path: "/n8n-receive-order", 
      type: "api",
      desc: "Cria o pedido e CALCULA O FRETE AUTOMATICAMENTE pelo bairro.",
      body: `{ 
  "customer": { "email": "teste@exemplo.com", "name": "Teste da Silva" }, 
  "items": [{ "name": "Produto Teste", "quantity": 1 }], 
  "shipping_address": { 
     "neighborhood": "Centro", 
     "city": "Curitiba" 
  },
  "payment_method": "pix" 
}`,
      response: `{ 
  "success": true, 
  "shipping_cost": 12.00, 
  "final_total": 112.00,
  "payment_info": { "qr_code": "..." } 
}`
    },
    { 
      id: "api_confirm_payment",
      name: "Confirmar Pagamento (Pix)",
      method: "POST", 
      path: "/update-order-status", 
      type: "api",
      desc: "Muda o status do pedido para 'Pago'. Use isto quando receber o webhook do banco.",
      body: `{ 
  "order_id": 12345,
  "status": "Pago"
}`,
      response: `{ 
  "success": true, 
  "message": "Pedido atualizado com sucesso."
}`
    },
    { 
      id: "api_update_logistics",
      name: "Atualizar Logística",
      method: "POST", 
      path: "/update-order-status", 
      type: "api",
      desc: "Atualiza status de entrega e rastreio.",
      body: `{ 
  "order_id": 12345,
  "delivery_status": "Despachado",
  "tracking_code": "BR123456789"
}`,
      response: `{ 
  "success": true, 
  "message": "Pedido atualizado com sucesso."
}`
    },
    { 
      id: "api_get_order",
      name: "Consultar Pedido",
      method: "GET", 
      path: "/get-order-details?id=12345", 
      type: "api",
      desc: "Consulta dados completos de um pedido específico.",
      body: `(Sem corpo - use Query Param ?id=)`,
      response: `{ 
  "id": 12345, 
  "status": "Pendente", 
  "total_price": 150.00,
  "order_items": [...]
}`
    }
  ];

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

  // Mutations
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

  // Teste de Webhooks da Tabela
  const testWebhookMutation = useMutation({
    mutationFn: async ({ id, url, event }: { id: number, url: string, event: string }) => {
        setTestingId(id);
        const { data, error } = await supabase.functions.invoke("test-webhook-endpoint", {
            body: { url, event_type: event, method: 'POST' }
        });
        
        if (error) throw error;
        return data;
    },
    onSuccess: (data) => {
        if (data.success) {
            showSuccess(`Sucesso! Status: ${data.status}`);
        } else {
            toast.error(`Falha: ${data.error}`, { description: `Código: ${data.status}.` });
        }
        setTestingId(null);
    },
    onError: (err: any) => {
        showError(`Erro ao testar: ${err.message}`);
        setTestingId(null);
    }
  });

  // Simulação Interativa (Modal)
  const simulationMutation = useMutation({
    mutationFn: async () => {
        setTestResponse(null);
        if (testItem.type === 'webhook') {
            // Simular envio para URL
            if (!testTargetUrl) throw new Error("Insira uma URL de destino.");
            const { data, error } = await supabase.functions.invoke("test-webhook-endpoint", {
                body: { url: testTargetUrl, event_type: testItem.event_key, method: 'POST' }
            });
            if (error) throw error;
            return data;
        } else {
            // Executar API Local
            if (!testItem.path) throw new Error("Endpoint inválido.");
            
            // Tratamento especial para GET com Query Params
            let url = baseUrl + testItem.path;
            let options: any = {
                method: testItem.method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            };

            if (testItem.method === "POST" || testItem.method === "PUT") {
                try {
                    // Valida JSON
                    JSON.parse(testRequestBody); 
                    options.body = testRequestBody;
                } catch (e) {
                    throw new Error("O corpo da requisição deve ser um JSON válido.");
                }
            } else if (testItem.method === "GET") {
                // Se o usuário editou o path no input (para mudar o ID por exemplo), poderíamos usar um input separado
                // Mas aqui estamos simplificando
            }

            const response = await fetch(url, options);
            const data = await response.json();
            return { status: response.status, data };
        }
    },
    onSuccess: (data) => {
        setTestResponse(data);
        showSuccess("Teste executado!");
    },
    onError: (err: any) => {
        setTestResponse({ error: err.message });
        showError(err.message);
    }
  });

  const runDiagnosticMutation = useMutation({
    mutationFn: async () => {
        const { data, error } = await supabase.functions.invoke("test-webhook-endpoint", {
            body: { url: diagnosticUrl, method: 'GET' }
        });
        if (error) throw error;
        return data;
    },
    onSuccess: (data) => {
        if (data.success) {
            showSuccess("CONECTADO! O servidor respondeu corretamente.");
            toast.success("Resposta Recebida:", { description: JSON.stringify(data.remote_response, null, 2) });
        } else {
            showError(`Erro na conexão: ${data.status} - ${data.error}`);
        }
    },
    onError: (err: any) => showError(err.message)
  });

  const generateToken = () => setToken("n8n_" + Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase());
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showSuccess("Copiado!"); };
  
  const toggleEndpoint = (id: string) => {
    setOpenEndpoints(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const startEditing = (hook: any) => {
    setEditingWebhookId(hook.id);
    setTempUrl(hook.target_url);
  };

  const handleOpenTest = (item: any) => {
    setTestItem(item);
    setTestResponse(null);
    if (item.type === 'webhook') {
        setTestTargetUrl(""); 
    } else {
        setTestRequestBody(item.body || "{}");
    }
    setIsTestModalOpen(true);
  };

  const getEventBadge = (event: string) => {
    switch (event) {
        case 'order_created': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pedido Finalizado</Badge>;
        case 'support_request': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Suporte</Badge>;
        default: return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">{event}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Workflow className="h-8 w-8 text-green-600" /> Automação WhatsApp (N8n)
        </h1>
        <p className="text-muted-foreground">Documentação técnica e configuração de eventos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
            {/* CARD DIAGNÓSTICO */}
            <Card className="border-orange-200 bg-orange-50/20 shadow-md">
                <CardHeader className="bg-orange-50/50 border-b pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
                        <Network className="w-5 h-5" /> Teste de Conectividade
                    </CardTitle>
                    <CardDescription className="text-orange-700/80">Verifique se o site consegue alcançar seu N8N.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                    <div className="space-y-1">
                        <Label>URL de Teste (GET)</Label>
                        <Input 
                            value={diagnosticUrl} 
                            onChange={(e) => setDiagnosticUrl(e.target.value)} 
                            className="bg-white font-mono text-xs"
                        />
                    </div>
                    <Button 
                        onClick={() => runDiagnosticMutation.mutate()} 
                        disabled={runDiagnosticMutation.isPending || !diagnosticUrl} 
                        className="w-full bg-orange-600 hover:bg-orange-700 font-bold"
                    >
                        {runDiagnosticMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                        Testar Ping
                    </Button>
                </CardContent>
            </Card>

            {/* CARD TOKEN */}
            <Card className="border-green-200 shadow-md">
                <CardHeader className="bg-green-50/30 border-b pb-4">
                    <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-green-600" /> Token de Segurança</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label>Authorization Bearer</Label><Button variant="link" size="sm" className="h-auto p-0 text-green-600" onClick={generateToken}>Gerar Novo</Button></div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono pr-10" />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(token)}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    <Button onClick={() => saveTokenMutation.mutate()} disabled={saveTokenMutation.isPending || !token} className="w-full bg-green-600 hover:bg-green-700 font-bold">{saveTokenMutation.isPending ? "Salvando..." : <><Save className="w-4 h-4 mr-2" /> Salvar Token</>}</Button>
                </CardContent>
            </Card>
        </div>

        {/* Coluna Direita: Tabs */}
        <div className="lg:col-span-2">
            <Tabs defaultValue="webhooks">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="endpoints"><Globe className="w-4 h-4 mr-2" /> Swagger / Docs</TabsTrigger>
                    <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Configurar Gatilhos</TabsTrigger>
                </TabsList>

                <TabsContent value="endpoints">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>Eventos Disponíveis</CardTitle>
                            <CardDescription>Estrutura dos dados enviados para o seu N8N.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div>
                                <h3 className="text-sm font-black uppercase text-purple-600 mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Gatilhos (Sistema &rarr; N8N)</h3>
                                <div className="space-y-3">
                                    {webhookEvents.map((evt) => (
                                        <Collapsible key={evt.id} open={openEndpoints.includes(evt.id)} onOpenChange={() => toggleEndpoint(evt.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                            <div className="flex items-center justify-between p-3 bg-purple-50/50 hover:bg-purple-50 cursor-pointer transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden" onClick={() => toggleEndpoint(evt.id)}>
                                                    <Badge className="bg-purple-600 hover:bg-purple-700 w-24 justify-center">EVENTO</Badge>
                                                    <span className="font-semibold text-sm truncate">{evt.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-purple-600 hover:bg-purple-100" onClick={(e) => { e.stopPropagation(); handleOpenTest(evt); }} title="Testar Disparo">
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); setSelectedDoc(evt); }}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <div onClick={() => toggleEndpoint(evt.id)} className="cursor-pointer">
                                                        {openEndpoints.includes(evt.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                                    </div>
                                                </div>
                                            </div>
                                            <CollapsibleContent>
                                                <div className="p-4 bg-slate-50 border-t space-y-3">
                                                    <p className="text-sm text-gray-600">{evt.desc}</p>
                                                    <div className="bg-slate-900 text-slate-50 p-3 rounded-md font-mono text-xs overflow-x-auto border border-slate-700"><pre>{evt.payload}</pre></div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase text-emerald-600 mb-3 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4" /> API (Recebimento do N8N)</h3>
                                <div className="space-y-3">
                                    {apiActions.map((api) => (
                                        <Collapsible key={api.id} open={openEndpoints.includes(api.id)} onOpenChange={() => toggleEndpoint(api.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                            <div className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden" onClick={() => toggleEndpoint(api.id)}>
                                                    <Badge className={api.method === "GET" ? "bg-blue-600 hover:bg-blue-700 w-24 justify-center" : "bg-emerald-600 hover:bg-emerald-700 w-24 justify-center"}>{api.method}</Badge>
                                                    <span className="font-mono text-xs font-bold text-slate-700 truncate">{api.path}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-100" onClick={(e) => { e.stopPropagation(); handleOpenTest(api); }} title="Testar Endpoint">
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); setSelectedDoc(api); }}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <div onClick={() => toggleEndpoint(api.id)} className="cursor-pointer">
                                                        {openEndpoints.includes(api.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                                    </div>
                                                </div>
                                            </div>
                                            <CollapsibleContent>
                                                <div className="p-4 bg-slate-50 border-t space-y-4">
                                                    <div className="flex items-center gap-2 bg-white border p-2 rounded"><span className="text-xs font-mono text-gray-600 select-all flex-1">{baseUrl}{api.path.split('?')[0]}</span><Button variant="ghost" size="sm" className="h-6" onClick={() => copyToClipboard(baseUrl + api.path.split('?')[0])}><Copy className="w-3 h-3" /></Button></div>
                                                    <p className="text-xs text-gray-500 font-medium mt-2">{api.desc}</p>
                                                    <div className="bg-slate-900 text-yellow-300 p-3 rounded-md font-mono text-xs overflow-x-auto h-32 border border-slate-700"><pre>{api.body}</pre></div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="webhooks">
                    <Card>
                        <CardHeader><CardTitle>Meus Webhooks</CardTitle><CardDescription>Cadastre as URLs do seu N8N/Typebot para receber os eventos.</CardDescription></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-dashed">
                                <Label className="text-xs font-bold uppercase text-gray-500">Novo Gatilho</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                                        <SelectTrigger className="w-[250px] bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="order_created">Pedido Finalizado</SelectItem>
                                            <SelectItem value="support_request">Solicitação de Suporte</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input placeholder="https://seu-n8n.com/webhook/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-white" />
                                    <Button onClick={() => addWebhookMutation.mutate()} disabled={addWebhookMutation.isPending}><Plus className="w-4 h-4" /></Button>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Evento</TableHead><TableHead>URL de Destino</TableHead><TableHead className="w-12 text-center">Teste</TableHead><TableHead className="w-12">Ativo</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {isLoadingWebhooks ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-4">Carregando...</TableCell></TableRow>
                                        ) : webhooks && webhooks.length > 0 ? (
                                            webhooks.map((hook) => (
                                                <TableRow key={hook.id}>
                                                    <TableCell>{getEventBadge(hook.trigger_event)}</TableCell>
                                                    <TableCell>
                                                        {editingWebhookId === hook.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input value={tempUrl} onChange={(e) => setTempUrl(e.target.value)} className="h-8 text-xs font-mono" autoFocus />
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => updateWebhookUrlMutation.mutate({ id: hook.id, url: tempUrl })}><Check className="w-4 h-4" /></Button>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingWebhookId(null)}><X className="w-4 h-4" /></Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between group">
                                                                <span className="font-mono text-xs max-w-[250px] truncate" title={hook.target_url}>{hook.target_url}</span>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" onClick={() => startEditing(hook)}><Pencil className="w-3 h-3" /></Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-slate-100 hover:bg-slate-200" onClick={() => testWebhookMutation.mutate({ id: hook.id, url: hook.target_url, event: hook.trigger_event })} disabled={testWebhookMutation.isPending} title="Enviar dados de teste">
                                                            {testingId === hook.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-orange-500" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell><Switch checked={hook.is_active} onCheckedChange={(val) => toggleWebhookMutation.mutate({ id: hook.id, status: val })} /></TableCell>
                                                    <TableCell><Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => deleteWebhookMutation.mutate(hook.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
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

      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {selectedDoc?.type === 'webhook' ? <ArrowUpRight className="w-5 h-5 text-purple-600" /> : <ArrowDownLeft className="w-5 h-5 text-emerald-600" />}
                    {selectedDoc?.name || "Detalhes"}
                </DialogTitle>
                <DialogDescription>
                    {selectedDoc?.desc}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {selectedDoc?.path && (
                    <div className="space-y-1">
                        <Label>URL do Endpoint</Label>
                        <div className="flex items-center gap-2 bg-slate-100 border p-2 rounded">
                            <span className="font-mono text-sm text-slate-800 break-all">{baseUrl}{selectedDoc.path.split('?')[0]}</span>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(baseUrl + selectedDoc.path.split('?')[0])}><Copy className="w-4 h-4" /></Button>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <Label>{selectedDoc?.type === 'webhook' ? 'JSON Enviado (Payload)' : 'Corpo da Requisição (Body)'}</Label>
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => copyToClipboard(selectedDoc?.payload || selectedDoc?.body)}>
                            <Copy className="w-3 h-3 mr-1" /> Copiar JSON
                        </Button>
                    </div>
                    <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-slate-700 shadow-inner">
                        <pre>{selectedDoc?.payload || selectedDoc?.body}</pre>
                    </div>
                </div>

                {selectedDoc?.response && (
                    <div className="space-y-1 pt-2 border-t">
                        <Label>Exemplo de Resposta</Label>
                        <div className="bg-slate-900 text-yellow-300 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-slate-700 shadow-inner">
                            <pre>{selectedDoc.response}</pre>
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button onClick={() => setSelectedDoc(null)}>Fechar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Simulação/Teste */}
      <Dialog open={isTestModalOpen} onOpenChange={(open) => { setIsTestModalOpen(open); if(!open) setTestResponse(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-500" />
                    Simulador: {testItem?.name}
                </DialogTitle>
                <DialogDescription>
                    {testItem?.type === 'webhook' 
                        ? "Envie o payload de exemplo para sua URL do N8N/Typebot." 
                        : "Execute o endpoint real no seu backend (usando o token salvo)."}
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {testItem?.type === 'webhook' ? (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>URL de Destino (Webhook URL)</Label>
                            <Input 
                                placeholder="https://seu-n8n.com/webhook/teste" 
                                value={testTargetUrl} 
                                onChange={(e) => setTestTargetUrl(e.target.value)} 
                            />
                        </div>
                        <div className="bg-slate-100 p-3 rounded text-xs font-mono border">
                            <p className="text-slate-500 font-bold mb-1">Payload a ser enviado:</p>
                            <pre className="whitespace-pre-wrap">{testItem?.payload}</pre>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Endpoint</Label>
                            <div className="p-2 bg-slate-100 rounded border font-mono text-sm">
                                <Badge className="mr-2">{testItem?.method}</Badge>
                                {baseUrl}{testItem?.path.split('?')[0]}
                            </div>
                        </div>
                        {testItem?.method !== 'GET' && (
                            <div className="space-y-1">
                                <Label>Corpo da Requisição (Body)</Label>
                                <Textarea 
                                    className="font-mono text-xs h-32 bg-slate-50"
                                    value={testRequestBody}
                                    onChange={(e) => setTestRequestBody(e.target.value)}
                                />
                            </div>
                        )}
                        {testItem?.method === 'GET' && testItem?.path.includes('?') && (
                            <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                Nota: Esta simulação usa o ID fixo da documentação. Para IDs reais, use o Postman.
                            </p>
                        )}
                    </div>
                )}

                {testResponse && (
                    <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-green-700 font-bold">Resposta do Servidor</Label>
                            {testResponse.status && <Badge variant="outline">{testResponse.status}</Badge>}
                        </div>
                        <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto shadow-inner max-h-60 border border-slate-700">
                            <pre>{JSON.stringify(testResponse, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => setIsTestModalOpen(false)}>Fechar</Button>
                <Button 
                    onClick={() => simulationMutation.mutate()} 
                    disabled={simulationMutation.isPending || (testItem?.type === 'webhook' && !testTargetUrl)}
                    className="bg-orange-600 hover:bg-orange-700 font-bold"
                >
                    {simulationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Executar Teste
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default N8nIntegrationPage;
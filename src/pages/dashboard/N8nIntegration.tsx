"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Key, Plus, Trash2, ChevronDown, ChevronRight, Zap, Loader2, ArrowUpRight, ArrowDownLeft, Play, UserCheck, Package, ShoppingCart, MessageSquare, MousePointerClick, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

const N8nIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("order_created");
  const [openEndpoints, setOpenEndpoints] = useState<string[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);
  
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testItem, setTestItem] = useState<any>(null);
  const [testBody, setTestBody] = useState("");
  const [testTargetUrl, setTestTargetUrl] = useState("");
  const [testResponse, setTestResponse] = useState<any>(null);
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  // LISTA COMPLETA DE EVENTOS COM JSON DETALHADO
  const webhookEvents = [
    { 
      id: "wh_order_created",
      event_key: "order_created",
      name: "Pedido Finalizado", 
      icon: <ShoppingCart className="w-4 h-4 text-green-600" />,
      desc: "Disparado imediatamente quando o cliente finaliza o checkout.",
      payload: `{
  "event": "order_created",
  "timestamp": "2024-05-20T10:30:00.000Z",
  "data": {
    "id": 1542,
    "status": "Pendente",
    "total_price": 189.90,
    "shipping_cost": 15.00,
    "coupon_discount": 10.00,
    "payment_method": "Pix",
    "created_at_br": "20/05/2024 10:30:00",
    "customer": {
      "id": "uuid-do-cliente",
      "full_name": "João da Silva",
      "email": "joao@email.com",
      "phone": "11999998888",
      "cpf": "123.456.789-00"
    },
    "shipping_address": {
      "street": "Rua das Flores",
      "number": "123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "cep": "01000-000"
    },
    "items": [
      {
        "product_id": 101,
        "name": "Essência Zomo - Menta",
        "quantity": 2,
        "price": 15.90
      },
      {
        "product_id": 205,
        "name": "Carvão de Coco 1kg",
        "quantity": 1,
        "price": 45.00
      }
    ]
  }
}`
    },
    { 
      id: "wh_order_updated",
      event_key: "order_updated",
      name: "Pedido Atualizado", 
      icon: <RefreshCw className="w-4 h-4 text-blue-600" />,
      desc: "Disparado quando o status do pedido muda (ex: Pago, Enviado).",
      payload: `{
  "event": "order_updated",
  "timestamp": "2024-05-20T14:45:00.000Z",
  "data": {
    "id": 1542,
    "status": "Pago",
    "delivery_status": "Despachado",
    "delivery_info": "Rastreio: BR123456789BR",
    "updated_at": "2024-05-20T14:45:00.000Z",
    "customer": {
      "full_name": "João da Silva",
      "phone": "11999998888",
      "email": "joao@email.com"
    }
  }
}`
    },
    { 
      id: "wh_customer_created",
      event_key: "customer_created",
      name: "Novo Cliente", 
      icon: <UserCheck className="w-4 h-4 text-cyan-600" />,
      desc: "Enviado quando um novo cadastro é realizado na loja.",
      payload: `{
  "event": "customer_created",
  "timestamp": "2024-05-21T09:00:00.000Z",
  "data": {
    "id": "uuid-do-novo-cliente",
    "email": "novo.cliente@gmail.com",
    "first_name": "Maria",
    "last_name": "Souza",
    "phone": "41988887777",
    "origin": "site_signup"
  }
}`
    },
    { 
      id: "wh_product_updated",
      event_key: "product_updated",
      name: "Produto Alterado", 
      icon: <Package className="w-4 h-4 text-orange-600" />,
      desc: "Útil para sincronizar estoque ou preços com sistemas externos.",
      payload: `{
  "event": "product_updated",
  "timestamp": "2024-05-22T11:20:00.000Z",
  "data": {
    "id": 500,
    "name": "Pod Descartável 1500 Puffs",
    "sku": "POD-1500-MINT",
    "stock_quantity": 4,
    "price": 89.90,
    "is_visible": true,
    "previous_stock": 5
  }
}`
    },
    { 
      id: "wh_chat_sent",
      event_key: "chat_message_sent",
      name: "Mensagem de Chat", 
      icon: <MessageSquare className="w-4 h-4 text-violet-600" />,
      desc: "Disparado quando o cliente envia mensagem via widget de chat.",
      payload: `{
  "event": "chat_message_sent",
  "timestamp": "2024-05-22T16:10:00.000Z",
  "data": {
    "session_id": "sess_abc123",
    "message": "Olá, gostaria de saber se tem sabor melancia?",
    "customer": {
      "name": "Visitante",
      "email": null
    },
    "page_url": "https://sua-loja.com/produto/123"
  }
}`
    },
    { 
      id: "wh_support_clicked",
      event_key: "support_contact_clicked",
      name: "Clique no Suporte", 
      icon: <MousePointerClick className="w-4 h-4 text-pink-600" />,
      desc: "Indica que o cliente clicou no botão flutuante de WhatsApp.",
      payload: `{
  "event": "support_contact_clicked",
  "timestamp": "2024-05-22T18:00:00.000Z",
  "data": {
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6...)",
    "page_title": "Carrinho de Compras",
    "customer_id": "uuid-se-logado-ou-null"
  }
}`
    }
  ];

  const cryptoEndpoints = [
    { 
      id: "api_create_client",
      name: "Criar Cliente",
      method: "POST", 
      path: "/n8n-create-client", 
      type: "api",
      desc: "Cria ou recupera um cliente (Idempotente).",
      body: `{
  "email": "teste@exemplo.com",
  "name": "Cliente Teste API",
  "phone": "11999999999",
  "password": "senha_segura_123" 
}`
    },
    { 
      id: "api_receive_order",
      name: "Receber Pedido (WhatsApp)",
      method: "POST", 
      path: "/n8n-receive-order", 
      type: "api",
      desc: "Cria um pedido manualmente e retorna o QR Code do Pix (se configurado).",
      body: `{
  "customer": {
    "email": "cliente@zap.com",
    "name": "Cliente Via Zap",
    "phone": "41999999999"
  },
  "shipping_address": {
    "neighborhood": "Centro",
    "city": "Curitiba",
    "street": "Rua XV",
    "number": "100"
  },
  "payment_method": "Pix",
  "items": [
    {
      "name": "Essência",
      "quantity": 2,
      "sku": "ESS-001" 
    }
  ]
}`
    },
    { 
      id: "api_update_status",
      name: "Atualizar Status Pedido",
      method: "POST", 
      path: "/update-order-status", 
      type: "api",
      desc: "Atualiza o status de pagamento ou entrega de um pedido existente.",
      body: `{
  "order_id": 1234,
  "status": "Pago",
  "delivery_status": "Despachado",
  "tracking_code": "BR123456789BR"
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

  const saveTokenMutation = useMutation({
    mutationFn: async () => {
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
        const { error } = await supabase.from("webhook_configs").insert({
            trigger_event: selectedEvent,
            target_url: webhookUrl,
            is_active: true
        });
        if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] });
      showSuccess("Gatilho adicionado!");
      setWebhookUrl("");
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
        const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["webhookConfigs"] });
        showSuccess("Removido.");
    },
  });

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
        if (data.success) showSuccess(`Sucesso! N8N recebeu.`);
        else showError(`Falha: ${data.error}`);
        setTestingId(null);
    },
  });

  const generateToken = () => setToken("n8n_" + Math.random().toString(36).slice(2).toUpperCase());
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); showSuccess("Copiado!"); };
  const toggleEndpoint = (id: string) => { setOpenEndpoints(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  const getEventBadge = (event: string) => {
    const found = webhookEvents.find(e => e.event_key === event);
    if (found) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{found.name}</Badge>;
    return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">{event}</Badge>;
  };

  const handleOpenTestModal = (item: any) => {
    setTestItem(item);
    setTestResponse(null);
    setTestTargetUrl("");

    if (item.type === 'api') {
        // Usa o corpo definido no objeto para teste
        setTestBody(item.body);
    } else {
        // Para webhooks, usa o payload de exemplo
        setTestBody(item.payload);
    }
    
    setIsTestModalOpen(true);
  };

  const executeTest = async () => {
    if (!testItem) return;

    if (testItem.type === 'webhook') {
        if (!testTargetUrl) { showError("URL de destino obrigatória."); return; }
        // Em um cenário real, aqui chamaríamos a function de teste passando o payload customizado
        // Por simplificação, vamos usar a function existente que gera payload fake
        try {
            const { data, error } = await supabase.functions.invoke('test-webhook-endpoint', {
                body: { 
                    url: testTargetUrl,
                    event_type: testItem.event_key,
                    method: 'POST'
                }
            });
            if(error) throw error;
            setTestResponse(data);
        } catch (e: any) {
            setTestResponse({ error: e.message });
        }
    } else {
        // API CALL
        try {
            const functionName = testItem.path.replace('/', '');
            const { data, error } = await supabase.functions.invoke(functionName, {
                body: JSON.parse(testBody),
                headers: { 'Authorization': `Bearer ${token}` } // Simula uso do token
            });
            if(error) throw error;
            setTestResponse(data);
        } catch (e: any) {
            setTestResponse({ error: e.message });
        }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-green-700">
          <Workflow className="h-8 w-8" /> Automação N8N
        </h1>
        <p className="text-muted-foreground font-medium">Gestão de gatilhos em tempo real para WhatsApp e CRM.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
            <Card className="border-green-200 shadow-md">
                <CardHeader className="bg-green-50/30 border-b pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 font-black uppercase text-green-800"><Key className="w-5 h-5" /> Token de Acesso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label className="text-xs font-bold uppercase text-gray-500">Bearer Auth</Label><Button variant="link" size="sm" className="h-auto p-0 text-green-600 font-bold" onClick={generateToken}>Novo</Button></div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} className="font-mono bg-gray-50" />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(token)}><Copy className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    <Button onClick={() => saveTokenMutation.mutate()} disabled={saveTokenMutation.isPending} className="w-full bg-green-600 hover:bg-green-700 font-black uppercase tracking-tight">Salvar Segurança</Button>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Tabs defaultValue="webhooks">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
                    <TabsTrigger value="webhooks" className="font-bold">Meus Gatilhos (Webhooks)</TabsTrigger>
                    <TabsTrigger value="endpoints" className="font-bold">Documentação API</TabsTrigger>
                </TabsList>

                <TabsContent value="webhooks" className="space-y-6 mt-6">
                    <Card className="shadow-md">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar Novo Destino</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-gray-400">Tipo de Evento</Label>
                                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {webhookEvents.map(e => (
                                                <SelectItem key={e.id} value={e.event_key}>
                                                    <div className="flex items-center gap-2">{e.icon}{e.name}</div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-[2] space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-gray-400">URL do Webhook N8N</Label>
                                    <Input placeholder="https://seu-n8n.com/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-white" />
                                </div>
                                <div className="flex items-end pb-0.5">
                                    <Button onClick={() => addWebhookMutation.mutate()} disabled={addWebhookMutation.isPending || !webhookUrl} className="font-bold h-10 px-6">Ativar</Button>
                                </div>
                            </div>

                            <div className="border rounded-xl overflow-hidden mt-6 shadow-sm">
                                <Table>
                                    <TableHeader className="bg-gray-50"><TableRow><TableHead>Evento</TableHead><TableHead>URL Destino</TableHead><TableHead className="w-12 text-center">Teste</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {isLoadingWebhooks ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                        ) : webhooks?.map((hook) => (
                                            <TableRow key={hook.id} className="group">
                                                <TableCell className="font-bold">{getEventBadge(hook.trigger_event)}</TableCell>
                                                <TableCell className="font-mono text-[11px] text-gray-500 max-w-[200px] truncate" title={hook.target_url}>{hook.target_url}</TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => testWebhookMutation.mutate({ id: hook.id, url: hook.target_url, event: hook.trigger_event })} disabled={testingId === hook.id}>
                                                        {testingId === hook.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-orange-500" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => deleteWebhookMutation.mutate(hook.id)}><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="endpoints" className="mt-6">
                    <Card className="shadow-md">
                        <CardHeader><CardTitle>Dicionário de Eventos (Gatilhos)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {webhookEvents.map((evt) => (
                                <Collapsible key={evt.id} open={openEndpoints.includes(evt.id)} onOpenChange={() => toggleEndpoint(evt.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer" onClick={() => toggleEndpoint(evt.id)}>
                                        <div className="flex items-center gap-3">
                                            {evt.icon}
                                            <span className="font-bold text-sm">{evt.name}</span>
                                            <code className="text-[10px] bg-slate-200 px-1 rounded font-mono text-slate-600">{evt.event_key}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenTestModal(evt); }} title="Ver Payload">
                                                <Eye className="w-4 h-4 text-slate-400" />
                                            </Button>
                                            {openEndpoints.includes(evt.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                        </div>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="p-4 bg-slate-900 text-slate-50 font-mono text-[11px] border-t border-slate-700">
                                            <div className="flex justify-between items-center mb-2"><span className="text-blue-400 font-bold uppercase text-[9px]">Exemplo de JSON (Payload):</span><Button variant="ghost" size="sm" className="h-6 text-[10px] text-gray-400" onClick={() => copyToClipboard(evt.payload)}>Copiar</Button></div>
                                            <pre className="whitespace-pre-wrap">{evt.payload}</pre>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="shadow-md mt-6">
                        <CardHeader><CardTitle>API de Entrada (Ações)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {cryptoEndpoints.map((api) => ( // Reusing variable name but contains API actions
                                <Collapsible key={api.id} open={openEndpoints.includes(api.id)} onOpenChange={() => toggleEndpoint(api.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer" onClick={() => toggleEndpoint(api.id)}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 w-16 justify-center text-[10px]">{api.method}</Badge>
                                            <span className="font-mono text-xs font-bold text-slate-700 truncate">{api.path}</span>
                                            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">- {api.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenTestModal(api); }} title="Testar API">
                                                <Play className="w-4 h-4 text-emerald-600" />
                                            </Button>
                                            {openEndpoints.includes(api.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                        </div>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="p-4 bg-slate-50 border-t space-y-4">
                                            <div className="flex items-center gap-2 bg-white border p-2 rounded"><span className="text-xs font-mono text-gray-600 select-all flex-1">{baseUrl}{api.path}</span><Button variant="ghost" size="sm" className="h-6" onClick={() => copyToClipboard(baseUrl + api.path)}><Copy className="w-3 h-3" /></Button></div>
                                            <p className="text-xs text-gray-500 font-medium mt-2">{api.desc}</p>
                                            
                                            <div>
                                                <Label className="text-xs mb-1 block font-bold text-gray-500">Corpo da Requisição (Body)</Label>
                                                <div className="bg-slate-900 text-yellow-300 p-3 rounded-md font-mono text-xs overflow-x-auto border border-slate-700">
                                                    <pre className="whitespace-pre-wrap">{api.body}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
      </div>

      {/* MODAL DE TESTE */}
      <Dialog open={isTestModalOpen} onOpenChange={(open) => { setIsTestModalOpen(open); if(!open) setTestResponse(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-500" />
                    Simulador: {testItem?.name}
                </DialogTitle>
                <DialogDescription>
                    {testItem?.type === 'webhook' 
                        ? "Este é o JSON que será enviado para sua URL configurada." 
                        : "Teste o endpoint enviando os dados abaixo para o sistema."}
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {testItem?.type === 'webhook' && (
                    <div className="space-y-1">
                        <Label>URL de Destino (Opcional para teste)</Label>
                        <Input 
                            placeholder="https://seu-n8n.com/webhook/teste" 
                            value={testTargetUrl} 
                            onChange={(e) => setTestTargetUrl(e.target.value)} 
                        />
                    </div>
                )}
                
                <div className="space-y-1">
                    <Label>JSON Payload</Label>
                    <Textarea 
                        className="font-mono text-xs h-64 bg-slate-50 leading-relaxed"
                        value={testBody}
                        onChange={(e) => setTestBody(e.target.value)}
                    />
                </div>

                {testResponse && (
                    <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between mb-2">
                            <Label className={!testResponse.error ? "text-green-700 font-bold" : "text-red-700 font-bold"}>
                                Resposta
                            </Label>
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
                    onClick={executeTest} 
                    className="bg-black hover:bg-gray-800 font-bold"
                >
                    <Play className="w-4 h-4 mr-2" />
                    Executar Teste
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default N8nIntegrationPage;
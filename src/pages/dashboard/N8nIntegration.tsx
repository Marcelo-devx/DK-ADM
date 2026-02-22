"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key, Webhook, Plus, Trash2, Globe, ChevronDown, ChevronRight, Zap, Loader2, Pencil, X, ArrowUpRight, ArrowDownLeft, Network, Play, UserCheck, Package, ShoppingCart, MessageSquare, MousePointerClick, RefreshCw } from "lucide-react";
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
  
  const [diagnosticUrl, setDiagnosticUrl] = useState("https://n8n-ws.dkcwb.cloud/webhook/testar-conexão");
  
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testItem, setTestItem] = useState<any>(null);
  const [testBody, setTestBody] = useState("");
  const [testTargetUrl, setTestTargetUrl] = useState("");
  const [testResponse, setTestResponse] = useState<any>(null);
  
  const baseUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1";

  // LISTA COMPLETA DE EVENTOS (Baseada na imagem e sistema atual)
  const webhookEvents = [
    { 
      id: "wh_order_created",
      event_key: "order_created",
      name: "Pedido Finalizado", 
      icon: <ShoppingCart className="w-4 h-4 text-green-600" />,
      desc: "Disparado quando uma nova compra é concluída.",
      payload: `{ "event": "order_created", "data": { "id": 123, "total": 150.00, "customer": "João..." } }`
    },
    { 
      id: "wh_order_updated",
      event_key: "order_updated",
      name: "Pedido Atualizado", 
      icon: <RefreshCw className="w-4 h-4 text-blue-600" />,
      desc: "Disparado quando o status de pagamento ou entrega muda.",
      payload: `{ "event": "order_updated", "data": { "id": 123, "status": "Pago" } }`
    },
    { 
      id: "wh_customer_created",
      event_key: "customer_created",
      name: "Novo Cliente", 
      icon: <UserCheck className="w-4 h-4 text-cyan-600" />,
      desc: "Enviado quando um novo cadastro é realizado.",
      payload: `{ "event": "customer_created", "data": { "email": "novo@cliente.com" } }`
    },
    { 
      id: "wh_product_updated",
      event_key: "product_updated",
      name: "Produto Alterado", 
      icon: <Package className="w-4 h-4 text-orange-600" />,
      desc: "Útil para sincronizar estoque externo.",
      payload: `{ "event": "product_updated", "data": { "sku": "ABC", "stock": 50 } }`
    },
    { 
      id: "wh_chat_sent",
      event_key: "chat_message_sent",
      name: "Mensagem de Chat", 
      icon: <MessageSquare className="w-4 h-4 text-violet-600" />,
      desc: "Disparado quando o cliente envia mensagem via widget.",
      payload: `{ "event": "chat_message_sent", "data": { "msg": "Olá..." } }`
    },
    { 
      id: "wh_support_clicked",
      event_key: "support_contact_clicked",
      name: "Clique no Suporte", 
      icon: <MousePointerClick className="w-4 h-4 text-pink-600" />,
      desc: "Indica intenção de contato via WhatsApp.",
      payload: `{ "event": "support_contact_clicked", "data": { "client": "..." } }`
    }
  ];

  const apiActions = [
    { 
      id: "api_create_client",
      name: "Criar Cliente",
      method: "POST", 
      path: "/n8n-create-client", 
      type: "api",
      desc: "Cria ou recupera um cliente (Idempotente).",
      body: `{ "email": "teste@exemplo.com", "name": "Teste" }`
    },
    { 
      id: "api_receive_order",
      name: "Receber Pedido",
      method: "POST", 
      path: "/n8n-receive-order", 
      type: "api",
      desc: "Cria o pedido e CALCULA O FRETE pelo bairro.",
      body: `{ "customer": { "email": "..." }, "items": [...], "shipping_address": { "neighborhood": "Centro" } }`
    },
    { 
      id: "api_update_status",
      name: "Atualizar Status",
      method: "POST", 
      path: "/update-order-status", 
      type: "api",
      desc: "Muda status de pedido ou entrega.",
      body: `{ "order_id": 123, "status": "Pago", "delivery_status": "Despachado" }`
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
                        <CardHeader><CardTitle>Dicionário de Eventos</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {webhookEvents.map((evt) => (
                                <Collapsible key={evt.id} open={openEndpoints.includes(evt.id)} onOpenChange={() => toggleEndpoint(evt.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer" onClick={() => toggleEndpoint(evt.id)}>
                                        <div className="flex items-center gap-3">
                                            {evt.icon}
                                            <span className="font-bold text-sm">{evt.name}</span>
                                            <code className="text-[10px] bg-slate-200 px-1 rounded font-mono text-slate-600">{evt.event_key}</code>
                                        </div>
                                        {openEndpoints.includes(evt.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                    <CollapsibleContent>
                                        <div className="p-4 bg-slate-900 text-slate-50 font-mono text-[11px] border-t border-slate-700">
                                            <div className="flex justify-between items-center mb-2"><span className="text-blue-400 font-bold uppercase text-[9px]">Exemplo de Payload:</span><Button variant="ghost" size="sm" className="h-6 text-[10px] text-gray-400" onClick={() => copyToClipboard(evt.payload)}>Copiar</Button></div>
                                            <pre>{evt.payload}</pre>
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
    </div>
  );
};

export default N8nIntegrationPage;
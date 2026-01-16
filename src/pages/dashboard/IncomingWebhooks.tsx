"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Webhook, Copy, ExternalLink, ShieldCheck, Truck, CreditCard, BellRing, ArrowLeftRight, Globe, Save, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { API_URL } from "@/data/constants";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const IncomingWebhooksPage = () => {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("");

  // Busca a URL salva no banco ou usa a atual
  const { data: savedUrl, isLoading } = useQuery({
    queryKey: ["siteBaseUrl"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "site_url").single();
      return data?.value;
    }
  });

  useEffect(() => {
    if (savedUrl) {
        setBaseUrl(savedUrl);
    } else if (typeof window !== "undefined") {
        setBaseUrl(window.location.origin);
    }
  }, [savedUrl]);

  const saveUrlMutation = useMutation({
    mutationFn: async (url: string) => {
        // Remove barra final se houver
        const cleanUrl = url.replace(/\/$/, "");
        const { error } = await supabase.from("app_settings").upsert({ key: "site_url", value: cleanUrl }, { onConflict: "key" });
        if (error) throw error;
        return cleanUrl;
    },
    onSuccess: (cleanUrl) => {
        queryClient.invalidateQueries({ queryKey: ["siteBaseUrl"] });
        setBaseUrl(cleanUrl);
        showSuccess("URL base salva!");
    },
    onError: (err: any) => showError(err.message)
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copiado!");
  };

  const webhooks = [
    {
      id: "mp",
      title: "Mercado Pago (IPN)",
      description: "Cole esta URL no campo 'Webhooks' ou 'Notificações IPN' do Mercado Pago.",
      url: `${API_URL}/mp-webhook`,
      icon: <CreditCard className="w-5 h-5 text-blue-500" />,
      docs: "https://www.mercadopago.com.br/developers/panel/notifications/ipn",
      instructions: "Painel MP > Seus Negócios > Configurações > Notificações Webhooks."
    },
    {
      id: "ps",
      title: "PagSeguro (Notificação)",
      description: "Cole esta URL para receber atualizações de status de transações.",
      url: `${API_URL}/pagseguro-webhook`,
      icon: <ShieldCheck className="w-5 h-5 text-green-500" />,
      docs: "https://pagseguro.uol.com.br/vendedor/configuracoes.html",
      instructions: "Painel PS > Venda Online > Integrações > Notificação de Transação."
    },
    {
      id: "spoke",
      title: "Spoke / Circuit (Logística)",
      description: "Receba atualizações de entrega (Saiu para entrega, Entregue).",
      url: `${API_URL}/spoke-webhook`,
      icon: <Truck className="w-5 h-5 text-orange-500" />,
      docs: "https://getcircuit.com/",
      instructions: "Configure nas opções de API/Webhook da sua conta Circuit/Spoke."
    },
    {
      id: "generic",
      title: "Webhook Genérico",
      description: "Endpoint para integrações personalizadas (N8N, Typebot).",
      url: `${API_URL}/dispatch-webhook`,
      icon: <BellRing className="w-5 h-5 text-gray-500" />,
      docs: "#",
      instructions: "Envia eventos JSON personalizados para sua loja."
    }
  ];

  // Garante que a URL base não tenha barra no final para concatenar corretamente
  const cleanBase = baseUrl.replace(/\/$/, "");

  const redirects = [
    {
      label: "URL de Sucesso (Back URL Success)",
      value: `${cleanBase}/meus-pedidos`,
      desc: "Para onde o cliente vai após pagar com sucesso."
    },
    {
      label: "URL de Pendência (Back URL Pending)",
      value: `${cleanBase}/meus-pedidos`,
      desc: "Para onde o cliente vai se o pagamento estiver em análise."
    },
    {
      label: "URL de Falha (Back URL Failure)",
      value: `${cleanBase}/`,
      desc: "Para onde o cliente vai se o pagamento falhar ou for cancelado."
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-8 w-8 text-primary" /> Configurações de Integração
        </h1>
        <p className="text-muted-foreground">
          URLs necessárias para conectar seus gateways de pagamento e logística.
        </p>
      </div>

      {/* SEÇÃO 0: CONFIGURAÇÃO DE URL BASE */}
      <Card className="border-blue-200 bg-blue-50/20">
        <CardContent className="p-4 flex flex-col md:flex-row items-end md:items-center gap-4">
            <div className="flex-1 space-y-1 w-full">
                <Label className="text-xs font-bold uppercase text-blue-700 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Domínio da Loja (Produção)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                    Defina o endereço real do seu site (ex: https://sualoja.com) para gerar os links de retorno corretos.
                </p>
                <div className="flex gap-2">
                    <Input 
                        value={baseUrl} 
                        onChange={(e) => setBaseUrl(e.target.value)} 
                        placeholder="https://seu-dominio.com"
                        className="bg-white"
                    />
                    <Button 
                        onClick={() => saveUrlMutation.mutate(baseUrl)} 
                        disabled={saveUrlMutation.isPending}
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                    >
                        {saveUrlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar URL
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 1: WEBHOOKS (Servidor para Servidor) */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
            <Webhook className="w-5 h-5" /> Webhooks (Notificações)
        </h2>
        <div className="grid gap-6">
            {webhooks.map((hook) => (
            <Card key={hook.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b pb-4">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg border shadow-sm">
                        {hook.icon}
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {hook.title}
                        </CardTitle>
                        <CardDescription>{hook.description}</CardDescription>
                    </div>
                </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                    <Input 
                        readOnly 
                        value={hook.url} 
                        className="font-mono text-sm bg-slate-50 text-slate-700 border-slate-200" 
                        onClick={(e) => e.currentTarget.select()}
                    />
                    </div>
                    <Button variant="outline" onClick={() => copyToClipboard(hook.url)} className="shrink-0">
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                    </Button>
                </div>
                
                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <p className="flex-1"><strong>Onde colar:</strong> {hook.instructions}</p>
                    {hook.docs !== "#" && (
                        <a 
                            href={hook.docs} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                            Abrir Site <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
                </CardContent>
            </Card>
            ))}
        </div>
      </div>

      {/* SEÇÃO 2: REDIRECTS (URLs de Retorno) */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-700">
            <ArrowLeftRight className="w-5 h-5" /> URLs de Retorno (Back URLs / Fallback)
        </h2>
        <Card>
            <CardHeader className="bg-gray-50/50 border-b">
                <CardTitle className="text-base">Redirecionamento Pós-Pagamento</CardTitle>
                <CardDescription>
                    Links baseados em: <strong className="text-primary">{cleanBase}</strong>. 
                    Certifique-se de que este domínio está correto antes de configurar no gateway.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                {redirects.map((r, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm font-bold text-gray-700">{r.label}</span>
                            <span className="text-xs text-muted-foreground">{r.desc}</span>
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                readOnly 
                                value={r.value} 
                                className="font-mono text-sm bg-slate-50 border-slate-200" 
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(r.value)}>
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IncomingWebhooksPage;
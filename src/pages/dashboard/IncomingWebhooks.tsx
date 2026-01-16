"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Webhook, Copy, ExternalLink, ShieldCheck, Truck, CreditCard, BellRing } from "lucide-react";
import { showSuccess } from "@/utils/toast";
import { API_URL } from "@/data/constants";

const IncomingWebhooksPage = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("URL copiada para a área de transferência!");
  };

  const webhooks = [
    {
      id: "mp",
      title: "Mercado Pago",
      description: "Configure esta URL para receber notificações de pagamento (IPN) e atualizações de status de pedidos.",
      url: `${API_URL}/mp-webhook`,
      icon: <CreditCard className="w-5 h-5 text-blue-500" />,
      docs: "https://www.mercadopago.com.br/developers/panel/notifications/ipn",
      instructions: "No painel do Mercado Pago, vá em 'Seus Negócios' > 'Configurações' > 'Gestão e Administração' > 'Notificações Webhooks' ou 'IPN'."
    },
    {
      id: "ps",
      title: "PagSeguro",
      description: "Utilize esta URL para a Notificação de Transação do PagSeguro.",
      url: `${API_URL}/pagseguro-webhook`,
      icon: <ShieldCheck className="w-5 h-5 text-green-500" />,
      docs: "https://pagseguro.uol.com.br/vendedor/configuracoes.html",
      instructions: "No PagSeguro, acesse 'Venda Online' > 'Integrações' > 'Notificação de Transação'."
    },
    {
      id: "spoke",
      title: "Spoke / Circuit (Logística)",
      description: "Para receber atualizações de status de entrega (Saiu para entrega, Entregue, Falhou).",
      url: `${API_URL}/spoke-webhook`,
      icon: <Truck className="w-5 h-5 text-orange-500" />,
      docs: "https://getcircuit.com/",
      instructions: "Configure nas opções de API/Webhook da sua conta Circuit/Spoke."
    },
    {
      id: "generic",
      title: "Webhook Genérico",
      description: "Endpoint multiúso para integrações personalizadas (recebe JSON com event_type).",
      url: `${API_URL}/dispatch-webhook`,
      icon: <BellRing className="w-5 h-5 text-gray-500" />,
      docs: "#",
      instructions: "Use este endpoint para enviar eventos customizados para sua loja."
    }
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-8 w-8 text-primary" /> Webhooks de Entrada
        </h1>
        <p className="text-muted-foreground">
          Estas são as URLs que você deve configurar nos sistemas externos para que sua loja receba atualizações automáticas (pagamentos, entregas, etc).
        </p>
      </div>

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
                  <Copy className="w-4 h-4 mr-2" /> Copiar URL
                </Button>
              </div>
              
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <p className="flex-1"><strong>Onde configurar:</strong> {hook.instructions}</p>
                {hook.docs !== "#" && (
                    <a 
                        href={hook.docs} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                        Abrir Painel <ExternalLink className="w-3 h-3" />
                    </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default IncomingWebhooksPage;
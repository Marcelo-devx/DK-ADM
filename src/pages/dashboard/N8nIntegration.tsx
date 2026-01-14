"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, Copy, Eye, EyeOff, Save, Check, Key } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const N8nIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  
  // URL fixa baseada no projeto Supabase
  const endpointUrl = "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/n8n-receive-order";

  const { data: settings } = useQuery({
    queryKey: ["n8nSettings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "n8n_integration_token")
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (settings?.value) {
      setToken(settings.value);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (token.length < 8) throw new Error("O token deve ter pelo menos 8 caracteres.");
      
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "n8n_integration_token", value: token }, { onConflict: "key" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8nSettings"] });
      showSuccess("Token de integração salvo com sucesso!");
    },
    onError: (err: any) => showError(err.message),
  });

  const generateToken = () => {
    const random = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    setToken("n8n_" + random.toUpperCase());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copiado para a área de transferência!");
  };

  const exampleJson = `{
  "customer": {
    "email": "cliente@whatsapp.com",
    "name": "João da Silva",
    "phone": "5511999999999"
  },
  "items": [
    { 
      "sku": "PROD-XYZ", 
      "quantity": 1 
    },
    { 
      "name": "Essência Zomo Menta", 
      "quantity": 2 
    }
  ],
  "payment_method": "Pix"
}`;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Workflow className="h-8 w-8 text-orange-600" />
          Automação & API (N8N)
        </h1>
        <p className="text-muted-foreground">
          Configure a integração para receber pedidos automáticos via WhatsApp, n8n ou Typebot.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Configuração */}
        <Card className="border-orange-200 shadow-md">
          <CardHeader className="bg-orange-50/30 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-600" /> Credenciais de Acesso
            </CardTitle>
            <CardDescription>
                Defina uma senha segura para permitir que seu bot crie pedidos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
                <Label>Endpoint URL (Webhook)</Label>
                <div className="flex gap-2">
                    <Input value={endpointUrl} readOnly className="bg-gray-50 font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(endpointUrl)}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Cole esta URL no nó "HTTP Request" do n8n.</p>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Token Secreto (Bearer Token)</Label>
                    <Button variant="link" size="sm" className="h-auto p-0 text-orange-600" onClick={generateToken}>
                        Gerar Aleatório
                    </Button>
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input 
                            type={showToken ? "text" : "password"} 
                            value={token} 
                            onChange={(e) => setToken(e.target.value)} 
                            className="font-mono pr-10"
                            placeholder="Crie ou gere uma senha..."
                        />
                        <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-0 top-0 h-full text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowToken(!showToken)}
                        >
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(token)}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || !token}
                className="w-full bg-orange-600 hover:bg-orange-700 font-bold"
            >
                {saveMutation.isPending ? "Salvando..." : <><Save className="w-4 h-4 mr-2" /> Salvar Configuração</>}
            </Button>
          </CardContent>
        </Card>

        {/* Card de Instruções */}
        <Card className="shadow-md">
          <CardHeader className="bg-gray-50/50 border-b pb-4">
            <CardTitle className="text-lg">Como Configurar no n8n</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Crie um nó <strong>HTTP Request</strong>.</li>
                <li>Defina o método como <Badge>POST</Badge>.</li>
                <li>No campo URL, cole o <strong>Endpoint URL</strong> ao lado.</li>
                <li>Em <strong>Authentication</strong>, escolha "Generic Credential Type" &rarr; "Header Auth".</li>
                <li>Nome do Header: <code>Authorization</code></li>
                <li>Valor: <code>Bearer SEU_TOKEN_AQUI</code></li>
                <li>No corpo da requisição (JSON), use o formato abaixo:</li>
            </ol>

            <div className="relative mt-4">
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
                    {exampleJson}
                </pre>
                <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute top-2 right-2 h-7 bg-slate-800 text-white hover:bg-slate-700 border-none"
                    onClick={() => copyToClipboard(exampleJson)}
                >
                    <Copy className="h-3 w-3 mr-1" /> Copiar JSON
                </Button>
            </div>

            <Alert className="bg-blue-50 border-blue-200 mt-4">
                <Check className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-bold">Dica</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs">
                    O sistema buscará produtos pelo <strong>SKU</strong> primeiro. Se não encontrar ou não tiver SKU, buscará pelo <strong>Nome</strong> (aproximado). O cliente será criado automaticamente se não existir.
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default N8nIntegrationPage;
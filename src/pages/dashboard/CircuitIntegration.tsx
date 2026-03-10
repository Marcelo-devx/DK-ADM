import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Globe, ShieldCheck, RefreshCw, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { showSuccess, showError } from "@/utils/toast";

const CircuitIntegrationPage = () => {
  const queryClient = useQueryClient();
  const [logisticsUrl, setLogisticsUrl] = useState("");
  const [logisticsToken, setLogisticsToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const [revealWebhook, setRevealWebhook] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      return data || [];
    },
  });

  useEffect(() => {
    if (settings) {
      setLogisticsUrl(settings.find(s => s.key === "logistics_api_url")?.value || "https://api.getcircuit.com/public/v0.2b");
      setLogisticsToken(settings.find(s => s.key === "logistics_api_token")?.value || "");
      setWebhookSecret(settings.find(s => s.key === "logistics_webhook_secret")?.value || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "logistics_api_url", value: logisticsUrl },
        { key: "logistics_api_token", value: logisticsToken },
        { key: "logistics_webhook_secret", value: webhookSecret }
      ];
      const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      showSuccess("Configurações salvas!");
    },
    onError: (err: any) => showError(err.message),
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
        await saveMutation.mutateAsync();
        
        // Testa buscando os planos, como na doc "List Plans"
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase.functions.invoke("spoke-proxy", {
            body: { 
              action: "plans", 
              params: { "filter.startsGte": today, "maxPageSize": 1 } 
            }
        });

        if (error) {
            let errorMsg = error.message;
            try {
                const body = await error.context.json();
                errorMsg = body.details || body.error || error.message;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        showSuccess("Conexão com Circuit estabelecida com sucesso!");
    } catch (err: any) {
        showError(`Falha no teste: ${err.message}`);
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold mb-4">Integração Circuit</h1>

      <Card className="border-blue-100 bg-blue-50/10 shadow-lg max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" /> Integração Circuit
          </CardTitle>
          <CardDescription>Gerencie aqui as suas chaves e configuração da integração com o Circuit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
              <Label className="font-bold">Base URL (API v0.2b)</Label>
              <Input value={logisticsUrl} onChange={(e) => setLogisticsUrl(e.target.value)} placeholder="https://api.getcircuit.com/public/v0.2b" />
              <p className="text-[10px] text-muted-foreground">URL Padrão: <code>https://api.getcircuit.com/public/v0.2b</code></p>
          </div>
          <div className="space-y-2 relative">
              <Label className="font-bold">API Key (Bearer Token)</Label>
              <div className="flex items-center gap-2">
                <Input type={revealToken ? 'text' : 'password'} value={logisticsToken} onChange={(e) => setLogisticsToken(e.target.value)} />
                <Button variant="ghost" onClick={() => setRevealToken(v => !v)}>
                  {revealToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Gere em: Configurações &gt; API no painel do Circuit.</p>
          </div>
          <div className="space-y-2 pt-4 border-t relative">
              <Label className="font-bold flex items-center gap-2 text-emerald-700">
                  <ShieldCheck className="w-4 h-4" /> Webhook Secret
              </Label>
              <div className="flex items-center gap-2">
                <Input type={revealWebhook ? 'text' : 'password'} placeholder="Chave secreta do Webhook (opcional)" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
                <Button variant="ghost" onClick={() => setRevealWebhook(v => !v)}>
                  {revealWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
          </div>
          <div className="pt-2 flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isTesting} className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold">
                  <Save className="w-4 h-4 mr-2" /> Salvar
              </Button>
              <Button onClick={handleTestConnection} disabled={isTesting || saveMutation.isPending} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Testar
              </Button>
          </div>

          <div className="pt-3 text-sm text-muted-foreground">
            {isLoading ? 'Carregando chaves...' : (logisticsToken || webhookSecret) ? 'Suas chaves atuais foram carregadas acima.' : 'Nenhuma chave encontrada. Insira e salve para integrar.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CircuitIntegrationPage;
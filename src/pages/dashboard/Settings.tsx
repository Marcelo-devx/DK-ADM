import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUploader } from "@/components/dashboard/ImageUploader";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Globe, Save, ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [logisticsUrl, setLogisticsUrl] = useState("");
  const [logisticsToken, setLogisticsToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      return data || [];
    },
  });

  useEffect(() => {
    if (settings) {
      setLogisticsUrl(settings.find(s => s.key === "logistics_api_url")?.value || "");
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
    // Primeiro salvamos para garantir que a função use os dados mais recentes
    try {
        await saveMutation.mutateAsync();
        
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase.functions.invoke("spoke-proxy", {
            body: { 
              action: "routes", 
              params: { date: today } 
            }
        });

        if (error) {
            // Tenta extrair a mensagem de erro detalhada da função
            let errorMsg = error.message;
            try {
                const body = await error.context.json();
                errorMsg = body.details || body.error || error.message;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        showSuccess("Sucesso! Conexão estabelecida com a API.");
    } catch (err: any) {
        showError(`Falha no teste: ${err.message}`);
    } finally {
        setIsTesting(false);
    }
  };

  const logoUrl = settings?.find(s => s.key === "logo_url")?.value || null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identidade da Loja</CardTitle>
            <CardDescription>Logo utilizada no painel e etiquetas.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ImageUploader
                onUploadSuccess={(url) => {
                    supabase.from("app_settings").upsert({ key: "logo_url", value: url }, { onConflict: "key" })
                    .then(() => queryClient.invalidateQueries({ queryKey: ["appSettings"] }));
                }}
                initialUrl={logoUrl}
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/10 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" /> Integração Spoke Dispatch
            </CardTitle>
            <CardDescription>Configure a comunicação com o sistema de rotas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label className="font-bold">Base URL (API)</Label>
                <Input value={logisticsUrl} onChange={(e) => setLogisticsUrl(e.target.value)} placeholder="Ex: https://spoke.com/dispatch/api" />
                <p className="text-[10px] text-muted-foreground">Insira a URL completa fornecida pela logística (sem o /v1 se não for necessário).</p>
            </div>
            <div className="space-y-2">
                <Label className="font-bold">API Key (Token)</Label>
                <Input type="password" value={logisticsToken} onChange={(e) => setLogisticsToken(e.target.value)} />
            </div>
            <div className="space-y-2 pt-4 border-t">
                <Label className="font-bold flex items-center gap-2 text-emerald-700">
                    <ShieldCheck className="w-4 h-4" /> Chave Secreta do Webhook
                </Label>
                <Input 
                    type="password"
                    placeholder="Cole a Chave Secreta gerada no painel da Spoke" 
                    value={webhookSecret} 
                    onChange={(e) => setWebhookSecret(e.target.value)}
                />
            </div>
            <div className="pt-2 flex gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isTesting} className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold">
                    <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
                <Button onClick={handleTestConnection} disabled={isTesting || saveMutation.isPending} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
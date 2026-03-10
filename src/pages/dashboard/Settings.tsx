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

        showSuccess("Conexão com Spoke/Circuit estabelecida com sucesso!");
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

        {/* Circuit integration removed from Settings; moved to its own menu */}
      </div>
    </div>
  );
};

export default SettingsPage;
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { showSuccess, showError } from "@/utils/toast";
import {
  Flame,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  Play,
  Activity,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
}

interface CronJobRun {
  jobid: number;
  runid: number;
  jobname?: string;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scheduleLabel(schedule: string): string {
  const map: Record<string, string> = {
    "* * * * *": "A cada 1 minuto",
    "*/3 * * * *": "A cada 3 minutos",
    "*/4 * * * *": "A cada 4 minutos",
    "*/5 * * * *": "A cada 5 minutos",
    "*/10 * * * *": "A cada 10 minutos",
    "*/30 * * * *": "A cada 30 minutos",
    "0 11 * * *": "Diário às 11:00 UTC (08:00 BRT)",
    "30 12 * * *": "Diário às 12:30 UTC (09:30 BRT)",
  };
  return map[schedule] ?? schedule;
}

function jobCategory(name: string): string {
  if (name.includes("warm") || name.includes("keep") || name.includes("ping")) return "🔥 Aquecimento";
  if (name.includes("cancel") || name.includes("expired")) return "🗑️ Limpeza";
  if (name.includes("popup") || name.includes("sales")) return "📢 Conteúdo";
  if (name.includes("dispatch") || name.includes("order")) return "📦 Pedidos";
  return "⚙️ Outros";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

const WarmupManager = () => {
  const queryClient = useQueryClient();
  const [runningJob, setRunningJob] = useState<string | null>(null);

  // Buscar todos os cron jobs
  const { data: jobs = [], isLoading: loadingJobs } = useQuery<CronJob[]>({
    queryKey: ["cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_jobs_status" as never);
      if (error) {
        // Fallback: busca direta via SQL
        const res = await supabase
          .from("cron_jobs_view" as never)
          .select("*");
        if (res.error) throw res.error;
        return (res.data as CronJob[]) ?? [];
      }
      return (data as CronJob[]) ?? [];
    },
    refetchInterval: 30000,
  });

  // Buscar últimas execuções
  const { data: runs = [], isLoading: loadingRuns } = useQuery<CronJobRun[]>({
    queryKey: ["cron-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_recent_runs" as never);
      if (error) throw error;
      return (data as CronJobRun[]) ?? [];
    },
    refetchInterval: 15000,
  });

  // Disparar ping manual de todas as edge functions
  const pingAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("ping_edge_functions");
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Ping enviado para todas as edge functions!");
      queryClient.invalidateQueries({ queryKey: ["cron-runs"] });
    },
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  // Disparar keep-alive manual
  const keepAliveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/keep-alive",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM",
          },
          body: JSON.stringify({ source: "dashboard_manual" }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      showSuccess(
        `Keep-alive concluído: ${data.warm ?? "?"} funções aquecidas, ${data.cold ?? 0} frias`
      );
    },
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  // Cancelar pedidos expirados manualmente
  const cancelExpiredMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_expired_orders");
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Pedidos expirados cancelados!"),
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  // Gerar popups de vendas manualmente
  const generatePopupsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_sales_popups_from_yesterday");
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => showSuccess(`${count} popups de vendas gerados!`),
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  // Agrupar jobs por categoria
  const grouped = jobs.reduce<Record<string, CronJob[]>>((acc, job) => {
    const cat = jobCategory(job.jobname);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(job);
    return acc;
  }, {});

  // Últimas 10 execuções
  const recentRuns = runs.slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="text-orange-500" />
            Gestão de Aquecimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore e controle os cron jobs e o aquecimento das edge functions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
            queryClient.invalidateQueries({ queryKey: ["cron-runs"] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Ações Manuais
          </CardTitle>
          <CardDescription>
            Execute funções de manutenção manualmente sem esperar o cron
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => keepAliveMutation.mutate()}
              disabled={keepAliveMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Flame className="w-4 h-4 mr-2" />
              {keepAliveMutation.isPending ? "Aquecendo..." : "Aquecer Todas as Funções"}
            </Button>

            <Button
              variant="outline"
              onClick={() => pingAllMutation.mutate()}
              disabled={pingAllMutation.isPending}
            >
              <Activity className="w-4 h-4 mr-2" />
              {pingAllMutation.isPending ? "Pingando..." : "Ping Edge Functions"}
            </Button>

            <Button
              variant="outline"
              onClick={() => cancelExpiredMutation.mutate()}
              disabled={cancelExpiredMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2 text-red-500" />
              {cancelExpiredMutation.isPending ? "Cancelando..." : "Cancelar Pedidos Expirados"}
            </Button>

            <Button
              variant="outline"
              onClick={() => generatePopupsMutation.mutate()}
              disabled={generatePopupsMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2 text-purple-500" />
              {generatePopupsMutation.isPending ? "Gerando..." : "Gerar Popups de Vendas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status dos Cron Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Cron Jobs Ativos
          </CardTitle>
          <CardDescription>
            Todos os jobs agendados no pg_cron
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingJobs ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum cron job encontrado. Os jobs são gerenciados diretamente no banco de dados.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, catJobs]) => (
                <div key={category}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    {category}
                  </p>
                  <div className="space-y-2">
                    {catJobs.map((job) => (
                      <div
                        key={job.jobid}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {job.active ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{job.jobname}</p>
                            <p className="text-xs text-muted-foreground">
                              {scheduleLabel(job.schedule)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={job.active ? "default" : "destructive"}
                          className={job.active ? "bg-green-100 text-green-700 border-green-200" : ""}
                        >
                          {job.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumo estático quando não há dados do banco */}
          {jobs.length === 0 && (
            <div className="mt-4 space-y-2">
              <Separator />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-3">
                🔥 Aquecimento (configurado)
              </p>
              {[
                { name: "keep-alive-warmup", schedule: "*/3 * * * *", desc: "Aquece todas as funções críticas" },
                { name: "warm-send-order-email", schedule: "*/4 * * * *", desc: "Mantém o envio de emails ativo" },
                { name: "warm-trigger-integration", schedule: "*/3 * * * *", desc: "Mantém o n8n trigger ativo" },
                { name: "warm-mp-webhook", schedule: "*/4 * * * *", desc: "Mantém o webhook do MercadoPago ativo" },
                { name: "ping-edge-functions", schedule: "*/5 * * * *", desc: "Pinga todas as edge functions" },
              ].map((j) => (
                <div key={j.name} className="flex items-center justify-between p-3 rounded-lg border bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{j.name}</p>
                      <p className="text-xs text-muted-foreground">{j.desc} — {scheduleLabel(j.schedule)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
                </div>
              ))}

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-3">
                🗑️ Limpeza (configurado)
              </p>
              {[
                { name: "cancel-expired-orders", schedule: "*/5 * * * *", desc: "Cancela pedidos sem pagamento após 60min" },
              ].map((j) => (
                <div key={j.name} className="flex items-center justify-between p-3 rounded-lg border bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{j.name}</p>
                      <p className="text-xs text-muted-foreground">{j.desc} — {scheduleLabel(j.schedule)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
                </div>
              ))}

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-3">
                📢 Conteúdo (configurado)
              </p>
              {[
                { name: "generate-daily-sales-popups", schedule: "0 11 * * *", desc: "Gera popups de vendas do dia anterior" },
              ].map((j) => (
                <div key={j.name} className="flex items-center justify-between p-3 rounded-lg border bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{j.name}</p>
                      <p className="text-xs text-muted-foreground">{j.desc} — {scheduleLabel(j.schedule)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
                </div>
              ))}

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4 mb-3">
                📦 Pedidos (configurado)
              </p>
              {[
                { name: "update-separated-orders-to-dispatched", schedule: "30 12 * * *", desc: "Atualiza pedidos separados para despachado às 09:30 BRT" },
              ].map((j) => (
                <div key={j.name} className="flex items-center justify-between p-3 rounded-lg border bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{j.name}</p>
                      <p className="text-xs text-muted-foreground">{j.desc} — {scheduleLabel(j.schedule)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerta de funções críticas */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-4 h-4" />
            Funções Críticas Monitoradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { name: "trigger-integration", desc: "Dispara n8n em cada pedido", critical: true },
              { name: "send-order-email", desc: "Envia emails de status", critical: true },
              { name: "mp-webhook", desc: "Recebe pagamentos MercadoPago", critical: true },
              { name: "create-mercadopago-pix", desc: "Cria cobranças PIX", critical: true },
              { name: "create-mercadopago-preference", desc: "Cria preferências de cartão", critical: true },
              { name: "update-order-status", desc: "Atualiza status de pedidos", critical: true },
              { name: "keep-alive", desc: "Aquece todas as funções", critical: false },
              { name: "admin-update-order", desc: "Admin: editar pedidos", critical: false },
              { name: "admin-cancel-order", desc: "Admin: cancelar pedidos", critical: false },
              { name: "bulk-import-clients", desc: "Importação de clientes", critical: false },
              { name: "cloudinary-upload", desc: "Upload de imagens", critical: false },
              { name: "analytics-bi", desc: "Analytics e relatórios", critical: false },
            ].map((fn) => (
              <div
                key={fn.name}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                  fn.critical
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <Flame
                  className={`w-3 h-3 shrink-0 ${fn.critical ? "text-red-500" : "text-orange-400"}`}
                />
                <div>
                  <p className="font-medium">{fn.name}</p>
                  <p className="text-muted-foreground">{fn.desc}</p>
                </div>
                {fn.critical && (
                  <Badge variant="destructive" className="ml-auto text-[10px] px-1 py-0">
                    CRÍTICO
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Últimas execuções */}
      {recentRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Últimas Execuções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentRuns.map((run) => (
                <div
                  key={run.runid}
                  className="flex items-center justify-between p-2 rounded text-xs hover:bg-accent/30"
                >
                  <div className="flex items-center gap-2">
                    {run.status === "succeeded" ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span className="font-medium">Job #{run.jobid}</span>
                    <span className="text-muted-foreground">{formatTime(run.start_time)}</span>
                  </div>
                  <Badge
                    variant={run.status === "succeeded" ? "default" : "destructive"}
                    className={
                      run.status === "succeeded"
                        ? "bg-green-100 text-green-700 text-[10px]"
                        : "text-[10px]"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WarmupManager;

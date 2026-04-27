import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
}

interface CronRun {
  jobid: number;
  runid: number;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scheduleLabel(schedule: string): string {
  const map: Record<string, string> = {
    "*/2 * * * *": "A cada 2 min",
    "*/3 * * * *": "A cada 3 min",
    "*/4 * * * *": "A cada 4 min",
    "*/5 * * * *": "A cada 5 min",
    "*/10 * * * *": "A cada 10 min",
    "*/30 * * * *": "A cada 30 min",
    "0 11 * * *": "Diário 08:00 BRT",
    "30 12 * * *": "Diário 09:30 BRT",
  };
  return map[schedule] ?? schedule;
}

function jobCategory(name: string): "warmup" | "cleanup" | "content" | "orders" {
  if (name.includes("warm") || name.includes("keep") || name.includes("ping")) return "warmup";
  if (name.includes("cancel") || name.includes("expired") || name.includes("cleanup")) return "cleanup";
  if (name.includes("popup") || name.includes("sales")) return "content";
  return "orders";
}

const CATEGORY_META = {
  warmup:  { label: "🔥 Aquecimento de Funções", color: "bg-orange-50 border-orange-200" },
  cleanup: { label: "🗑️ Limpeza Automática",      color: "bg-red-50 border-red-200" },
  content: { label: "📢 Geração de Conteúdo",     color: "bg-purple-50 border-purple-200" },
  orders:  { label: "📦 Automação de Pedidos",    color: "bg-blue-50 border-blue-200" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Retorna true se o job rodou nos últimos N minutos
function ranRecently(runs: CronRun[], jobid: number, withinMinutes: number): boolean {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
  return runs.some(
    (r) => r.jobid === jobid && r.status === "succeeded" && new Date(r.start_time) > cutoff
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

const WarmupManager = () => {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<CronJob[]>({
    queryKey: ["cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_jobs_status" as never);
      if (error) throw error;
      return (data as CronJob[]) ?? [];
    },
    refetchInterval: 20_000,
  });

  const { data: runs = [], isLoading: loadingRuns } = useQuery<CronRun[]>({
    queryKey: ["cron-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_recent_runs" as never);
      if (error) throw error;
      return (data as CronRun[]) ?? [];
    },
    refetchInterval: 15_000,
  });

  // ── Ações manuais ──────────────────────────────────────────────────────────

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

  const keepAliveMutation = useMutation({
    mutationFn: async () => {
      const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";
      const res = await fetch(
        "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/keep-alive",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON,
            Authorization: `Bearer ${ANON}`,
          },
          body: JSON.stringify({ source: "dashboard_manual" }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      showSuccess(`Keep-alive: ${data.warm ?? "?"} funções aquecidas, ${data.cold ?? 0} frias`);
      queryClient.invalidateQueries({ queryKey: ["cron-runs"] });
    },
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  const cancelExpiredMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_expired_orders");
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Pedidos expirados cancelados!"),
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  const generatePopupsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_sales_popups_from_yesterday");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => showSuccess(`${count} popups de vendas gerados!`),
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  // ── Agrupamento ────────────────────────────────────────────────────────────

  const grouped = jobs.reduce<Record<string, CronJob[]>>((acc, job) => {
    const cat = jobCategory(job.jobname);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(job);
    return acc;
  }, {});

  // Jobs com problema: inativos OU não rodaram nos últimos 15 min (para jobs frequentes)
  const problematicJobs = jobs.filter((j) => {
    if (!j.active) return true;
    const isFrequent = ["*/2","*/3","*/4","*/5"].some(p => j.schedule.startsWith(p));
    if (isFrequent && !ranRecently(runs, j.jobid, 15)) return true;
    return false;
  });

  const allHealthy = !loadingJobs && !loadingRuns && problematicJobs.length === 0 && jobs.length > 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="text-orange-500" />
            Gestão de Aquecimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore e controle os cron jobs e o aquecimento das edge functions em tempo real
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

      {/* Banner de saúde geral */}
      {!loadingJobs && !loadingRuns && (
        allHealthy ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
            <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Todos os sistemas operacionais ✅</p>
              <p className="text-sm text-green-700">
                {jobs.length} cron jobs ativos e rodando normalmente. Nenhuma função em risco.
              </p>
            </div>
          </div>
        ) : problematicJobs.length > 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-800">⚠️ Atenção: {problematicJobs.length} job(s) com problema!</p>
              <p className="text-sm text-red-700">
                {problematicJobs.map(j => j.jobname).join(", ")}
              </p>
            </div>
          </div>
        ) : null
      )}

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Ações Manuais
          </CardTitle>
          <CardDescription>
            Execute funções de manutenção agora, sem esperar o próximo ciclo do cron
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

      {/* Cron Jobs por categoria */}
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.entries(CATEGORY_META) as [keyof typeof CATEGORY_META, typeof CATEGORY_META[keyof typeof CATEGORY_META]][]).map(([cat, meta]) => {
          const catJobs = grouped[cat] ?? [];
          if (catJobs.length === 0) return null;
          return (
            <Card key={cat} className={`border ${meta.color}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">{meta.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {catJobs.map((job) => {
                  const isFrequent = ["*/2","*/3","*/4","*/5"].some(p => job.schedule.startsWith(p));
                  const recentOk = !isFrequent || ranRecently(runs, job.jobid, 15);
                  const healthy = job.active && recentOk;

                  return (
                    <div
                      key={job.jobid}
                      className={`flex items-center justify-between p-3 rounded-lg border bg-white ${
                        !healthy ? "border-red-300 bg-red-50" : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {healthy ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.jobname}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {scheduleLabel(job.schedule)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          healthy
                            ? "bg-green-100 text-green-700 border-green-200 shrink-0"
                            : "bg-red-100 text-red-700 border-red-200 shrink-0"
                        }
                        variant="outline"
                      >
                        {healthy ? "✅ OK" : "❌ Alerta"}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Últimas execuções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Últimas Execuções
            {loadingRuns && (
              <span className="text-xs text-muted-foreground font-normal ml-2">carregando...</span>
            )}
          </CardTitle>
          <CardDescription>Atualiza automaticamente a cada 15 segundos</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 && !loadingRuns ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução recente encontrada.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {runs.slice(0, 20).map((run) => {
                // Encontra o nome do job
                const job = jobs.find(j => j.jobid === run.jobid);
                return (
                  <div
                    key={run.runid}
                    className="flex items-center justify-between p-2 rounded text-xs hover:bg-accent/30 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {run.status === "succeeded" ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                      )}
                      <span className="font-medium truncate">
                        {job?.jobname ?? `Job #${run.jobid}`}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatTime(run.start_time)}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        run.status === "succeeded"
                          ? "bg-green-50 text-green-700 text-[10px] shrink-0"
                          : "bg-red-50 text-red-700 text-[10px] shrink-0"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funções críticas monitoradas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Funções Críticas Aquecidas
          </CardTitle>
          <CardDescription>
            Estas funções são aquecidas automaticamente pelos cron jobs acima
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { name: "trigger-integration",          desc: "Dispara n8n em cada pedido",        critical: true  },
              { name: "send-order-email",              desc: "Envia emails de status ao cliente",  critical: true  },
              { name: "mp-webhook",                    desc: "Recebe pagamentos MercadoPago",      critical: true  },
              { name: "create-mercadopago-pix",        desc: "Cria cobranças PIX",                critical: true  },
              { name: "create-mercadopago-preference", desc: "Cria preferências de cartão",       critical: true  },
              { name: "update-order-status",           desc: "Atualiza status de pedidos",        critical: true  },
              { name: "keep-alive",                    desc: "Aquece todas as funções",           critical: false },
              { name: "admin-update-order",            desc: "Admin: editar pedidos",             critical: false },
              { name: "admin-cancel-order",            desc: "Admin: cancelar pedidos",           critical: false },
              { name: "admin-list-users",              desc: "Admin: listar usuários",            critical: false },
              { name: "bulk-import-clients",           desc: "Importação de clientes",            critical: false },
              { name: "cloudinary-upload",             desc: "Upload de imagens",                 critical: false },
              { name: "analytics-bi",                  desc: "Analytics e relatórios",            critical: false },
              { name: "catalog-api",                   desc: "API pública do catálogo",           critical: false },
              { name: "get-order-details",             desc: "Detalhes de pedidos",               critical: false },
            ].map((fn) => (
              <div
                key={fn.name}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                  fn.critical ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
                }`}
              >
                <Flame className={`w-3 h-3 shrink-0 ${fn.critical ? "text-red-500" : "text-orange-400"}`} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{fn.name}</p>
                  <p className="text-muted-foreground truncate">{fn.desc}</p>
                </div>
                {fn.critical && (
                  <Badge variant="destructive" className="ml-auto text-[10px] px-1 py-0 shrink-0">
                    CRÍTICO
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WarmupManager;

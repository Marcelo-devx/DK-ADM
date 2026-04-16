import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  FileJson,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PipelineStep } from "@/hooks/useOrderHealth";
import { cn } from "@/lib/utils";

interface PipelineNodeProps {
  step: PipelineStep;
  isLast: boolean;
  onRedispatch?: () => void;
  isRedispatching?: boolean;
}

function formatTimestamp(ts?: string) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Human-readable label for the raw log status
function logStatusLabel(logStatus?: string): string | null {
  if (!logStatus) return null;
  const map: Record<string, string> = {
    sent: "Enviado ✓",
    success: "Sucesso ✓",
    sending: "Enviando...",
    processing: "Processando...",
    trigger_fired: "Disparado ✓",
    approved: "Aprovado ✓",
    processed: "Processado ✓",
    received: "Recebido ✓",
    fetched: "Consultado ✓",
    rejected: "Rejeitado",
    unauthorized: "Não autorizado",
    ignored: "Ignorado",
    no_action: "Sem ação",
    in_process: "Em processo",
    implied: "Criado ✓",
    implied_by_status: "Confirmado pelo status ✓",
    no_log: "Sem registro",
    error: "Erro",
  };
  return map[logStatus] ?? logStatus;
}

export function PipelineNode({
  step,
  isLast,
  onRedispatch,
  isRedispatching,
}: PipelineNodeProps) {
  const [payloadOpen, setPayloadOpen] = useState(false);

  const isError = step.status === "error";
  const isSuccess = step.status === "success";
  const isPending = step.status === "pending";
  const isWarning = step.status === "warning";
  const isNoLog = step.logStatus === "no_log";

  const circleClass = cn(
    "w-11 h-11 rounded-full flex items-center justify-center border-2 shadow-sm transition-all flex-shrink-0",
    isSuccess && "bg-green-50 border-green-400",
    isError && "bg-red-50 border-red-500 ring-4 ring-red-200 animate-pulse",
    isPending && "bg-gray-50 border-gray-300",
    isWarning && !isNoLog && "bg-yellow-50 border-yellow-400",
    isWarning && isNoLog && "bg-orange-50 border-orange-300"
  );

  const labelClass = cn(
    "mt-1.5 text-[10px] font-bold text-center leading-tight max-w-[80px]",
    isSuccess && "text-green-700",
    isError && "text-red-700",
    isPending && "text-gray-400",
    isWarning && !isNoLog && "text-yellow-700",
    isWarning && isNoLog && "text-orange-600"
  );

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {/* Node + connector row */}
      <div className="flex items-center w-full">
        {/* The node itself */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className={circleClass}>
            {isSuccess && <CheckCircle2 className="w-5 h-5 text-green-500" />}
            {isError && <XCircle className="w-5 h-5 text-red-500" />}
            {isPending && <Clock className="w-5 h-5 text-gray-300" />}
            {isWarning && !isNoLog && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            {isWarning && isNoLog && <AlertTriangle className="w-5 h-5 text-orange-400" />}
          </div>

          {/* Label */}
          <span className={labelClass}>
            {step.icon} {step.label}
          </span>

          {/* Timestamp or status badge */}
          {step.timestamp && isSuccess && (
            <span className="mt-0.5 text-[9px] text-gray-400 text-center">
              {formatTimestamp(step.timestamp)}
            </span>
          )}
          {step.logStatus && isSuccess && (
            <span className="mt-0.5 text-[9px] font-semibold text-green-600 text-center">
              {logStatusLabel(step.logStatus)}
            </span>
          )}
          {isPending && (
            <span className="mt-0.5 text-[9px] text-gray-400 text-center">
              Aguardando
            </span>
          )}
          {isWarning && isNoLog && (
            <span className="mt-0.5 text-[9px] font-semibold text-orange-500 text-center">
              Sem registro
            </span>
          )}
          {isWarning && !isNoLog && (
            <span className="mt-0.5 text-[9px] font-semibold text-yellow-600 text-center">
              {logStatusLabel(step.logStatus)}
            </span>
          )}
        </div>

        {/* Connector line */}
        {!isLast && (
          <div
            className={cn(
              "flex-1 h-0.5 mx-1",
              isSuccess ? "bg-green-300" : isWarning ? "bg-orange-200" : "bg-gray-200"
            )}
          />
        )}
      </div>

      {/* ── Warning banner for no_log (N8N sem registro) ─────────────────── */}
      {isWarning && isNoLog && (
        <div className="mt-3 w-full max-w-[220px]">
          <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-orange-800 leading-tight">
                  Sem registro de disparo
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">
                  Não há log confirmando que o N8N foi notificado para este pedido.
                </p>
                <p className="text-[10px] font-semibold text-orange-700 mt-1 leading-snug">
                  💡 O disparo pode ter ocorrido sem gravar log, ou o trigger falhou silenciosamente.
                </p>
                {onRedispatch && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-orange-200 text-orange-700 hover:bg-orange-100"
                      onClick={onRedispatch}
                      disabled={isRedispatching}
                    >
                      {isRedispatching ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3 mr-1" />
                      )}
                      {isRedispatching ? "Disparando..." : "Re-disparar N8N"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error banner — opens automatically ─────────────────────────── */}
      {isError && step.translatedError && (
        <div className="mt-3 w-full max-w-[220px]">
          <div
            className={cn(
              "rounded-xl border-2 p-3 shadow-lg",
              step.translatedError.severity === "critical"
                ? "bg-red-50 border-red-400"
                : "bg-yellow-50 border-yellow-400"
            )}
          >
            <div className="flex items-start gap-2">
              <XCircle
                className={cn(
                  "w-4 h-4 mt-0.5 flex-shrink-0",
                  step.translatedError.severity === "critical"
                    ? "text-red-500"
                    : "text-yellow-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-xs font-black leading-tight",
                    step.translatedError.severity === "critical"
                      ? "text-red-800"
                      : "text-yellow-800"
                  )}
                >
                  {step.translatedError.title}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">
                  {step.translatedError.description}
                </p>
                <p
                  className={cn(
                    "text-[10px] font-semibold mt-1 leading-snug",
                    step.translatedError.severity === "critical"
                      ? "text-red-700"
                      : "text-yellow-700"
                  )}
                >
                  💡 {step.translatedError.suggestion}
                </p>

                {step.rawDetails && (
                  <p className="text-[9px] font-mono text-gray-500 mt-1 break-all leading-snug">
                    {step.rawDetails}
                  </p>
                )}

                {step.responseCode && (
                  <span className="inline-block mt-1 text-[9px] font-mono bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    HTTP {step.responseCode}
                  </span>
                )}

                <div className="flex gap-1 mt-2 flex-wrap">
                  {step.rawPayload && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => setPayloadOpen(true)}
                    >
                      <FileJson className="w-3 h-3 mr-1" />
                      Ver payload
                    </Button>
                  )}
                  {onRedispatch && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                      onClick={onRedispatch}
                      disabled={isRedispatching}
                    >
                      {isRedispatching ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3 mr-1" />
                      )}
                      {isRedispatching ? "Disparando..." : "Re-disparar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payload modal */}
      <Dialog open={payloadOpen} onOpenChange={setPayloadOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-red-500" />
              Payload completo — {step.label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-3">
            {step.rawDetails && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-bold text-red-700 mb-1">
                  Detalhe do erro:
                </p>
                <p className="text-xs text-red-600 font-mono">{step.rawDetails}</p>
              </div>
            )}
            <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(step.rawPayload, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
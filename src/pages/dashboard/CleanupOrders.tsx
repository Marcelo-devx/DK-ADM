import { useState } from "react";
import { AlertTriangle, Trash2, ShieldCheck, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const PRESERVE_ORDER_ID = 492;

interface CleanupResult {
  success: boolean;
  message: string;
  deleted: {
    orders: number;
    order_items: number;
    order_history: number;
    primeiros_pedidos: number;
    loyalty_history_entries: number;
    user_coupons_linked: number;
  };
  preserved: {
    order_id: number;
    status: string;
    total_price: number;
    items_count: number;
  };
  remaining_orders: number;
  note: string;
}

export default function CleanupOrders() {
  const [confirmed, setConfirmed] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setShowDialog(false);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch(
        "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/cleanup-orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Erro desconhecido ao executar a limpeza.");
        return;
      }

      setResult(data as CleanupResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Limpeza de Pedidos</h1>
          <p className="text-sm text-gray-500">Ferramenta de preparação para abertura da loja</p>
        </div>
      </div>

      {/* Alerta principal */}
      {!result && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-red-800 font-bold text-base">
            ⚠️ Operação Irreversível
          </AlertTitle>
          <AlertDescription className="text-red-700 mt-1">
            Esta ação irá <strong>deletar permanentemente</strong> todos os pedidos do banco de dados,
            exceto o pedido <strong>#{PRESERVE_ORDER_ID}</strong> da Joice.
            <br />
            <span className="font-semibold">Não há como desfazer esta operação.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Card de informações — só mostra se não executou ainda */}
      {!result && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              O que será feito
            </CardTitle>
            <CardDescription>
              A operação executa as seguintes ações em sequência:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-red-700">Deletado:</span>
                  <span className="text-red-600"> Todos os pedidos (exceto #{PRESERVE_ORDER_ID})</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-red-700">Deletado:</span>
                  <span className="text-red-600"> Itens, histórico e registros vinculados aos pedidos deletados</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-green-700">Preservado:</span>
                  <span className="text-green-600"> Pedido #{PRESERVE_ORDER_ID} (Joice) com todos os seus dados</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-green-700">Restaurado automaticamente:</span>
                  <span className="text-green-600"> Estoque de todos os produtos (trigger do banco)</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-green-700">Mantido intacto:</span>
                  <span className="text-green-600"> Produtos, clientes, cupons, configurações e conteúdo do site</span>
                </div>
              </div>
            </div>

            {/* Confirmação */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <Checkbox
                  id="confirm"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(!!v)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="confirm"
                  className="text-sm font-medium text-amber-800 cursor-pointer leading-snug"
                >
                  Entendo que esta ação é <strong>irreversível</strong> e que todos os pedidos
                  (exceto o #{PRESERVE_ORDER_ID}) serão <strong>permanentemente deletados</strong>.
                </label>
              </div>
            </div>

            <Button
              variant="destructive"
              className="w-full mt-2 gap-2 font-bold"
              disabled={!confirmed || loading}
              onClick={() => setShowDialog(true)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executando limpeza...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Executar Limpeza de Pedidos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Erro na operação</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resultado de sucesso */}
      {result && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Limpeza Concluída com Sucesso!
            </CardTitle>
            <CardDescription className="text-green-700">
              {result.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pedido preservado */}
            <div className="p-3 bg-white rounded-lg border border-green-200">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
                ✅ Pedido Preservado
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="border-green-400 text-green-700 font-bold text-sm px-3 py-1">
                  Pedido #{result.preserved.order_id}
                </Badge>
                <span className="text-sm text-gray-600">
                  Status: <strong>{result.preserved.status}</strong>
                </span>
                <span className="text-sm text-gray-600">
                  Total: <strong>R$ {Number(result.preserved.total_price).toFixed(2)}</strong>
                </span>
                <span className="text-sm text-gray-600">
                  Itens: <strong>{result.preserved.items_count}</strong>
                </span>
              </div>
            </div>

            {/* O que foi deletado */}
            <div className="p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                🗑️ Registros Deletados
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pedidos:</span>
                  <span className="font-bold text-red-600">{result.deleted.orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Itens de pedido:</span>
                  <span className="font-bold text-red-600">{result.deleted.order_items}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Histórico de pedidos:</span>
                  <span className="font-bold text-red-600">{result.deleted.order_history}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Primeiros pedidos:</span>
                  <span className="font-bold text-red-600">{result.deleted.primeiros_pedidos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Histórico fidelidade:</span>
                  <span className="font-bold text-red-600">{result.deleted.loyalty_history_entries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cupons vinculados:</span>
                  <span className="font-bold text-red-600">{result.deleted.user_coupons_linked}</span>
                </div>
              </div>
            </div>

            {/* Nota sobre estoque */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">{result.note}</p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                Total de pedidos restantes no banco: <strong>{result.remaining_orders}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de confirmação final */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Confirmação Final
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-2">
              <span className="block">
                Você está prestes a deletar <strong>todos os pedidos</strong> do banco de dados,
                mantendo apenas o pedido <strong>#{PRESERVE_ORDER_ID}</strong> da Joice.
              </span>
              <span className="block font-semibold text-red-600">
                Esta ação não pode ser desfeita. Tem certeza absoluta?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecute}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, deletar tudo exceto #{PRESERVE_ORDER_ID}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

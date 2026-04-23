import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Search, Eye, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: number;
  order_id: number;
  operation: string;
  changed_fields: Record<string, { de: string; para: string }> | null;
  status_change: string | null;
  delivery_status_change: string | null;
  payment_method_change: string | null;
  total_price_change: string | null;
  shipping_cost_change: string | null;
  auth_uid: string | null;
  actor_name: string | null;
  actor_role: string | null;
  db_user: string | null;
  client_ip: string | null;
  user_agent: string | null;
  request_path: string | null;
  audited_at: string;
  audited_at_brt: string;
}

const operationBadge = (op: string) => {
  if (op === "DELETE")
    return <Badge className="bg-red-100 text-red-700 border-red-200">🗑 DELETE</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200">✏️ UPDATE</Badge>;
};

const roleBadge = (role: string | null) => {
  if (!role) return <span className="text-gray-400 text-xs">—</span>;
  const map: Record<string, string> = {
    adm: "bg-red-100 text-red-700",
    gerente_geral: "bg-indigo-100 text-indigo-700",
    gerente: "bg-purple-100 text-purple-700",
    logistica: "bg-green-100 text-green-700",
    user: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge className={`${map[role] ?? "bg-gray-100 text-gray-600"} text-xs`}>
      {role}
    </Badge>
  );
};

const ChangedFieldsView = ({ fields }: { fields: Record<string, { de: string; para: string }> | null }) => {
  if (!fields || Object.keys(fields).length === 0)
    return <span className="text-gray-400 text-xs">—</span>;

  return (
    <div className="flex flex-col gap-1">
      {Object.entries(fields).map(([key, val]) => (
        <div key={key} className="text-xs">
          <span className="font-semibold text-gray-600">{key}:</span>{" "}
          <span className="text-red-500 line-through">{val.de ?? "null"}</span>
          {" → "}
          <span className="text-green-600 font-medium">{val.para ?? "null"}</span>
        </div>
      ))}
    </div>
  );
};

export default function AuditoriaPedidos() {
  const [search, setSearch] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["auditoria-pedidos", orderIdFilter],
    queryFn: async () => {
      let query = supabase
        .from("order_audit_log_view" as any)
        .select("*")
        .order("audited_at", { ascending: false })
        .limit(500);

      if (orderIdFilter.trim()) {
        query = query.eq("order_id", parseInt(orderIdFilter.trim()));
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });

  const filtered = logs.filter((log) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      String(log.order_id).includes(s) ||
      (log.actor_name ?? "").toLowerCase().includes(s) ||
      (log.actor_role ?? "").toLowerCase().includes(s) ||
      (log.client_ip ?? "").includes(s) ||
      (log.operation ?? "").toLowerCase().includes(s) ||
      (log.auth_uid ?? "").toLowerCase().includes(s)
    );
  });

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria de Pedidos</h1>
          <p className="text-sm text-gray-500">
            Registro completo de todas as alterações e exclusões na tabela de pedidos
          </p>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
        <div>
          <strong>Registros imutáveis:</strong> Nenhum usuário pode apagar ou editar estes logs via API.
          Cada linha representa uma alteração real feita no banco, com IP, usuário e campos exatos que mudaram.
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, IP, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Input
            placeholder="Filtrar por nº pedido"
            value={orderIdFilter}
            onChange={(e) => setOrderIdFilter(e.target.value.replace(/\D/g, ""))}
            className="w-44"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <ScrollArea className="h-[calc(100vh-340px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-24">Pedido</TableHead>
                <TableHead className="w-24">Operação</TableHead>
                <TableHead>Campos Alterados</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Data/Hora (BRT)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                    Carregando registros...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow
                    key={log.id}
                    className={`hover:bg-gray-50 cursor-pointer ${log.operation === "DELETE" ? "bg-red-50/40" : ""}`}
                    onClick={() => setSelected(log)}
                  >
                    <TableCell className="text-xs text-gray-400">{log.id}</TableCell>
                    <TableCell>
                      <span className="font-bold text-gray-800">#{log.order_id}</span>
                    </TableCell>
                    <TableCell>{operationBadge(log.operation)}</TableCell>
                    <TableCell>
                      <ChangedFieldsView fields={log.changed_fields} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-gray-800">
                        {log.actor_name ?? <span className="text-gray-400 italic">Sistema/Trigger</span>}
                      </div>
                      {log.auth_uid && (
                        <div className="text-[10px] text-gray-400 font-mono truncate max-w-[140px]">
                          {log.auth_uid}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{roleBadge(log.actor_role)}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">
                      {log.client_ip ?? <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(log.audited_at_brt ?? log.audited_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setSelected(log); }}
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Modal de detalhes */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
              Detalhe do Log #{selected?.id} — Pedido #{selected?.order_id}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              {/* Operação */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">Operação:</span>
                {operationBadge(selected.operation)}
              </div>

              {/* Data */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">Data/Hora (BRT):</span>
                <span className="font-mono">{formatDate(selected.audited_at_brt ?? selected.audited_at)}</span>
              </div>

              {/* Quem */}
              <div className="flex items-start gap-2">
                <span className="text-gray-500 font-medium w-32">Usuário:</span>
                <div>
                  <div className="font-semibold">{selected.actor_name ?? "Sistema/Trigger"}</div>
                  {selected.auth_uid && (
                    <div className="text-xs font-mono text-gray-400">{selected.auth_uid}</div>
                  )}
                </div>
              </div>

              {/* Role */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">Role:</span>
                {roleBadge(selected.actor_role)}
              </div>

              {/* DB User */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">DB User:</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{selected.db_user ?? "—"}</span>
              </div>

              {/* IP */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">IP:</span>
                <span className="font-mono">{selected.client_ip ?? "—"}</span>
              </div>

              {/* Path */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium w-32">Caminho:</span>
                <span className="font-mono text-xs text-gray-600">{selected.request_path ?? "—"}</span>
              </div>

              {/* User Agent */}
              {selected.user_agent && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium w-32 shrink-0">User-Agent:</span>
                  <span className="text-xs text-gray-500 break-all">{selected.user_agent}</span>
                </div>
              )}

              {/* Campos alterados */}
              {selected.changed_fields && Object.keys(selected.changed_fields).length > 0 && (
                <div>
                  <p className="text-gray-500 font-medium mb-2">Campos Alterados:</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold">Campo</th>
                          <th className="text-left px-3 py-2 text-red-500 font-semibold">Antes</th>
                          <th className="text-left px-3 py-2 text-green-600 font-semibold">Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selected.changed_fields).map(([key, val]) => (
                          <tr key={key} className="border-t">
                            <td className="px-3 py-2 font-mono font-semibold text-gray-700">{key}</td>
                            <td className="px-3 py-2 text-red-500">{val.de ?? <em className="text-gray-300">null</em>}</td>
                            <td className="px-3 py-2 text-green-600 font-medium">{val.para ?? <em className="text-gray-300">null</em>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Snapshot completo */}
              <details className="mt-2">
                <summary className="cursor-pointer text-gray-400 text-xs hover:text-gray-600">
                  Ver snapshot completo do pedido (antes/depois)
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs font-semibold text-red-500 mb-1">ANTES</p>
                    <pre className="text-[10px] bg-red-50 border border-red-100 rounded p-2 overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

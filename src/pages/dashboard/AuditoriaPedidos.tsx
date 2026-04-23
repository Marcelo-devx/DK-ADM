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
import {
  ShieldCheck,
  Search,
  Eye,
  AlertTriangle,
  RefreshCw,
  Package,
  Zap,
  Globe,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
  actor_email: string | null;
  actor_role: string | null;
  db_user: string | null;
  client_ip: string | null;
  user_agent: string | null;
  referer: string | null;
  session_id: string | null;
  request_path: string | null;
  order_items_snapshot: Array<{
    item_id: number;
    nome: string;
    quantidade: number;
    preco_unit: number;
    subtotal: number;
    tipo: string;
    variant_id: string | null;
  }> | null;
  row_before: Record<string, unknown> | null;
  row_after: Record<string, unknown> | null;
  n8n_dispatch_snapshot: {
    dispatch_status: string;
    status_code: number;
    dispatched_at: string;
    payment_method: string;
    response_id: number;
  } | null;
  audited_at: string;
  audited_at_brt: string;
}

const operationBadge = (op: string) => {
  if (op === "DELETE")
    return <Badge className="bg-red-100 text-red-700 border-red-200 font-mono">🗑 DELETE</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-mono">✏️ UPDATE</Badge>;
};

const roleBadge = (role: string | null) => {
  if (!role) return <span className="text-gray-300 text-xs">—</span>;
  const map: Record<string, string> = {
    adm: "bg-red-100 text-red-700",
    gerente_geral: "bg-indigo-100 text-indigo-700",
    gerente: "bg-purple-100 text-purple-700",
    logistica: "bg-green-100 text-green-700",
    user: "bg-gray-100 text-gray-600",
  };
  return <Badge className={`${map[role] ?? "bg-gray-100 text-gray-600"} text-xs`}>{role}</Badge>;
};

const n8nStatusBadge = (status: string | null) => {
  if (!status) return null;
  if (status === "success") return <Badge className="bg-green-100 text-green-700 text-[10px]">✓ {status}</Badge>;
  return <Badge className="bg-red-100 text-red-700 text-[10px]">✗ {status}</Badge>;
};

const formatDate = (d: string) => {
  try { return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }); }
  catch { return d; }
};

const ChangedFieldsInline = ({ fields }: { fields: Record<string, { de: string; para: string }> | null }) => {
  if (!fields || Object.keys(fields).length === 0)
    return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {Object.entries(fields).map(([key, val]) => (
        <div key={key} className="text-xs leading-tight">
          <span className="font-semibold text-gray-500">{key}:</span>{" "}
          <span className="text-red-400 line-through">{val.de ?? "null"}</span>
          {" → "}
          <span className="text-green-600 font-semibold">{val.para ?? "null"}</span>
        </div>
      ))}
    </div>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="border rounded-xl overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
      {icon}
      <span className="text-sm font-semibold text-gray-700">{title}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Field = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400 font-medium w-36 shrink-0 pt-0.5">{label}</span>
    <span className={`text-xs text-gray-800 break-all ${mono ? "font-mono" : ""}`}>{value ?? <span className="text-gray-300">—</span>}</span>
  </div>
);

export default function AuditoriaPedidos() {
  const [search, setSearch] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["auditoria-pedidos", orderIdFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("order_audit_log_view")
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
      (log.actor_email ?? "").toLowerCase().includes(s) ||
      (log.actor_role ?? "").toLowerCase().includes(s) ||
      (log.client_ip ?? "").includes(s) ||
      (log.operation ?? "").toLowerCase().includes(s) ||
      (log.auth_uid ?? "").toLowerCase().includes(s) ||
      (log.db_user ?? "").toLowerCase().includes(s)
    );
  });

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-orange-100 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria de Pedidos</h1>
          <p className="text-sm text-gray-500">
            Registro imutável de todas as alterações e exclusões — com itens, N8N, IP, usuário e snapshot completo
          </p>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
        <div>
          <strong>Registros imutáveis:</strong> Nenhum usuário pode apagar ou editar estes logs via API.
          Cada linha captura: quem alterou, de onde, quando, o quê mudou, os itens do pedido e o status do N8N no momento da alteração.
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Nome, email, IP, role, UUID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Filtrar por nº pedido"
          value={orderIdFilter}
          onChange={(e) => setOrderIdFilter(e.target.value.replace(/\D/g, ""))}
          className="w-44"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <ScrollArea className="h-[calc(100vh-320px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-20">Pedido</TableHead>
                <TableHead className="w-24">Operação</TableHead>
                <TableHead>Campos Alterados</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead className="w-24">Role</TableHead>
                <TableHead className="w-32">IP</TableHead>
                <TableHead className="w-28">N8N</TableHead>
                <TableHead className="w-36">Data/Hora (BRT)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-gray-400">
                    Carregando registros...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-gray-400">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className={`hover:bg-gray-50/80 cursor-pointer ${log.operation === "DELETE" ? "bg-red-50/50" : ""}`}
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell>
                        <button className="text-gray-400 hover:text-gray-600">
                          {expandedRows.has(log.id)
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-gray-800">#{log.order_id}</span>
                      </TableCell>
                      <TableCell>{operationBadge(log.operation)}</TableCell>
                      <TableCell>
                        <ChangedFieldsInline fields={log.changed_fields} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-800 leading-tight">
                          {log.actor_name?.trim() || <span className="text-gray-400 italic text-xs">Sistema/Trigger</span>}
                        </div>
                        {log.actor_email && (
                          <div className="text-[10px] text-gray-400">{log.actor_email}</div>
                        )}
                        {log.auth_uid && (
                          <div className="text-[9px] text-gray-300 font-mono truncate max-w-[140px]">{log.auth_uid}</div>
                        )}
                      </TableCell>
                      <TableCell>{roleBadge(log.actor_role)}</TableCell>
                      <TableCell className="text-xs font-mono text-gray-600">
                        {log.client_ip ?? <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell>
                        {log.n8n_dispatch_snapshot
                          ? n8nStatusBadge(log.n8n_dispatch_snapshot.dispatch_status)
                          : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(log.audited_at_brt ?? log.audited_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setSelected(log); }}
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Linha expandida inline */}
                    {expandedRows.has(log.id) && (
                      <TableRow key={`${log.id}-expanded`} className="bg-slate-50/80">
                        <TableCell colSpan={10} className="py-3 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

                            {/* Itens do pedido */}
                            <div>
                              <p className="font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                <Package className="w-3.5 h-3.5" /> Itens do Pedido
                              </p>
                              {log.order_items_snapshot?.length ? (
                                <div className="space-y-1">
                                  {log.order_items_snapshot.map((item, i) => (
                                    <div key={i} className="bg-white border rounded-lg p-2">
                                      <div className="font-medium text-gray-700 leading-tight">{item.nome}</div>
                                      <div className="text-gray-400 mt-0.5">
                                        {item.quantidade}x R$ {Number(item.preco_unit).toFixed(2)} = <strong className="text-gray-600">R$ {Number(item.subtotal).toFixed(2)}</strong>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-gray-300">Sem itens capturados</span>}
                            </div>

                            {/* N8N */}
                            <div>
                              <p className="font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5" /> N8N Dispatch
                              </p>
                              {log.n8n_dispatch_snapshot ? (
                                <div className="bg-white border rounded-lg p-2 space-y-1">
                                  <div>Status: {n8nStatusBadge(log.n8n_dispatch_snapshot.dispatch_status)}</div>
                                  <div className="text-gray-500">HTTP: <strong>{log.n8n_dispatch_snapshot.status_code}</strong></div>
                                  <div className="text-gray-500">Pagamento: <strong>{log.n8n_dispatch_snapshot.payment_method}</strong></div>
                                  <div className="text-gray-400">Disparado: {formatDate(log.n8n_dispatch_snapshot.dispatched_at)}</div>
                                  <div className="text-gray-400">Response ID: {log.n8n_dispatch_snapshot.response_id}</div>
                                </div>
                              ) : <span className="text-gray-300">Sem dados N8N</span>}
                            </div>

                            {/* Contexto de rede */}
                            <div>
                              <p className="font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                <Globe className="w-3.5 h-3.5" /> Contexto de Rede
                              </p>
                              <div className="bg-white border rounded-lg p-2 space-y-1">
                                <div><span className="text-gray-400">IP:</span> <span className="font-mono">{log.client_ip ?? "—"}</span></div>
                                <div><span className="text-gray-400">Path:</span> <span className="font-mono text-[10px]">{log.request_path ?? "—"}</span></div>
                                <div><span className="text-gray-400">DB User:</span> <span className="font-mono">{log.db_user ?? "—"}</span></div>
                                {log.referer && <div><span className="text-gray-400">Referer:</span> <span className="font-mono text-[10px] break-all">{log.referer}</span></div>}
                                {log.user_agent && <div className="text-[10px] text-gray-300 break-all">{log.user_agent}</div>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Modal de detalhes completo */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
              Log #{selected?.id} — Pedido #{selected?.order_id} — {selected && formatDate(selected.audited_at_brt ?? selected.audited_at)}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">

              {/* Operação */}
              <div className="flex items-center gap-3">
                {operationBadge(selected.operation)}
                <span className="text-sm text-gray-500">{formatDate(selected.audited_at_brt ?? selected.audited_at)} (BRT)</span>
              </div>

              {/* Campos alterados */}
              {selected.changed_fields && Object.keys(selected.changed_fields).length > 0 && (
                <Section title="Campos Alterados" icon={<ShieldCheck className="w-4 h-4 text-orange-500" />}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 text-gray-500 font-semibold w-40">Campo</th>
                        <th className="text-left py-1.5 text-red-500 font-semibold">Antes</th>
                        <th className="text-left py-1.5 text-green-600 font-semibold">Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selected.changed_fields).map(([key, val]) => (
                        <tr key={key} className="border-b last:border-0">
                          <td className="py-1.5 font-mono font-semibold text-gray-700">{key}</td>
                          <td className="py-1.5 text-red-500">{val.de ?? <em className="text-gray-300">null</em>}</td>
                          <td className="py-1.5 text-green-600 font-semibold">{val.para ?? <em className="text-gray-300">null</em>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Ator */}
              <Section title="Quem fez a alteração" icon={<User className="w-4 h-4 text-blue-500" />}>
                <Field label="Nome" value={selected.actor_name?.trim() || "Sistema/Trigger"} />
                <Field label="Email" value={selected.actor_email} />
                <Field label="Role" value={roleBadge(selected.actor_role)} />
                <Field label="UUID" value={selected.auth_uid} mono />
                <Field label="DB User" value={selected.db_user} mono />
              </Section>

              {/* Rede */}
              <Section title="Contexto de Rede" icon={<Globe className="w-4 h-4 text-indigo-500" />}>
                <Field label="IP" value={selected.client_ip} mono />
                <Field label="Caminho (path)" value={selected.request_path} mono />
                <Field label="Referer" value={selected.referer} mono />
                <Field label="Session Info" value={selected.session_id} mono />
                <Field label="User-Agent" value={selected.user_agent} />
              </Section>

              {/* Itens do pedido */}
              <Section title="Itens do Pedido (no momento da alteração)" icon={<Package className="w-4 h-4 text-purple-500" />}>
                {selected.order_items_snapshot?.length ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 text-gray-500 font-semibold">Produto</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Qtd</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Preço Unit.</th>
                        <th className="text-right py-1.5 text-gray-500 font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.order_items_snapshot.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 text-gray-700">{item.nome}</td>
                          <td className="py-1.5 text-right text-gray-600">{item.quantidade}</td>
                          <td className="py-1.5 text-right text-gray-600">R$ {Number(item.preco_unit).toFixed(2)}</td>
                          <td className="py-1.5 text-right font-semibold text-gray-800">R$ {Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <span className="text-xs text-gray-400">Sem itens capturados</span>}
              </Section>

              {/* N8N */}
              <Section title="N8N Dispatch (no momento da alteração)" icon={<Zap className="w-4 h-4 text-yellow-500" />}>
                {selected.n8n_dispatch_snapshot ? (
                  <>
                    <Field label="Status" value={n8nStatusBadge(selected.n8n_dispatch_snapshot.dispatch_status)} />
                    <Field label="HTTP Code" value={selected.n8n_dispatch_snapshot.status_code} mono />
                    <Field label="Pagamento" value={selected.n8n_dispatch_snapshot.payment_method} />
                    <Field label="Disparado em" value={formatDate(selected.n8n_dispatch_snapshot.dispatched_at)} />
                    <Field label="Response ID" value={selected.n8n_dispatch_snapshot.response_id} mono />
                  </>
                ) : <span className="text-xs text-gray-400">Sem dados de dispatch N8N</span>}
              </Section>

              {/* Snapshot raw */}
              <details>
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
                  Ver snapshot JSON completo do pedido (antes / depois)
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-red-500 mb-1">ANTES</p>
                    <pre className="text-[10px] bg-red-50 border border-red-100 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                      {JSON.stringify(selected.row_before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">DEPOIS</p>
                    <pre className="text-[10px] bg-green-50 border border-green-100 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                      {JSON.stringify(selected.row_after ?? {}, null, 2)}
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

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal, Mail, KeyRound, RotateCcw,
  CheckCircle, Lock, Unlock, UserPlus, Eye, CalendarDays,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from "@/utils/toast";
import { CreateClientForm } from "@/components/dashboard/CreateClientForm";
import { ClientDetailsModal } from "@/components/dashboard/ClientDetailsModal";

interface Client {
  id: string;
  email: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "user" | "adm";
  force_pix_on_next_purchase: boolean;
  order_count: number;
  completed_order_count: number;
}

const PAGE_SIZE = 10;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM";

// ── Data fetchers ────────────────────────────────────────────────────────────

async function loadPage(page: number, search: string): Promise<Client[]> {
  const body: Record<string, unknown> = { limit: PAGE_SIZE, page };
  if (search) body.search = search;
  const { data, error } = await supabase.functions.invoke("get-users", { body });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Resposta inválida da Edge Function.");
  return data as Client[];
}

async function loadTotal(): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "user");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // debounced value
  const [showFlagged, setShowFlagged] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    action: "resend_confirmation" | "send_password_reset" | "delete_orders" | "mark_as_recurrent";
    client: Client;
  } | null>(null);

  // Debounce search — only fires query 600 ms after user stops typing
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 600);
  };
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: total = 0 } = useQuery<number>({
    queryKey: ["clientsTotal"],
    queryFn: loadTotal,
    staleTime: 60_000,
  });

  const {
    data: clients = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<Client[]>({
    queryKey: ["clients", page, search],
    queryFn: () => loadPage(page, search),
    staleTime: 30_000,
  });

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const visible = clients.filter((c) => {
    if (c.role === "adm") return false;
    if (showFlagged && !c.force_pix_on_next_purchase) return false;
    return true;
  });

  // ── Create client ────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch(
        "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/admin-create-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: ANON_KEY,
          },
          body: JSON.stringify(values),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error)
        throw new Error(json.details || json.error || `Erro ${res.status}`);
      return { json, values };
    },
    onSuccess: ({ json, values }) => {
      const created = json?.user || json;
      const nameParts = (values?.full_name || "").split(" ");
      const newClient: Client = {
        id: created?.id || `tmp-${Date.now()}`,
        email: created?.email || values?.email || "",
        first_name: nameParts[0] || null,
        last_name: nameParts.slice(1).join(" ") || null,
        created_at: created?.created_at || new Date().toISOString(),
        updated_at: null,
        role: "user",
        force_pix_on_next_purchase: true,
        order_count: 0,
        completed_order_count: 0,
      };

      // Update total count locally
      qc.setQueryData<number>(["clientsTotal"], (prev = 0) => prev + 1);

      // Prepend to page-1 cache (no refetch needed)
      qc.setQueryData<Client[]>(["clients", 1, ""], (prev = []) =>
        [newClient, ...prev].slice(0, PAGE_SIZE)
      );

      showSuccess("Cliente criado com sucesso!");
      setIsCreateOpen(false);
    },
    onError: (err: Error) => showError(`Erro ao criar cliente: ${err.message}`),
  });

  // ── Toggle PIX ───────────────────────────────────────────────────────────

  const togglePixMutation = useMutation({
    mutationFn: async ({ userId, forcePix }: { userId: string; forcePix: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ force_pix_on_next_purchase: forcePix })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return { userId, forcePix };
    },
    onMutate: ({ userId, forcePix }) => {
      // Optimistic update — instant UI response
      qc.setQueryData<Client[]>(["clients", page, search], (prev = []) =>
        prev.map((c) =>
          c.id === userId ? { ...c, force_pix_on_next_purchase: forcePix } : c
        )
      );
    },
    onSuccess: (_, { forcePix }) => {
      showSuccess(forcePix ? "Restrição de PIX ativada!" : "Cartão liberado!");
    },
    onError: (err: Error) => {
      showError(`Erro: ${err.message}`);
      qc.invalidateQueries({ queryKey: ["clients", page, search], exact: true });
    },
  });

  // ── User actions ─────────────────────────────────────────────────────────

  const actionMutation = useMutation({
    mutationFn: async ({ action, targetUserId }: { action: string; targetUserId: string }) => {
      let fnName = "admin-user-actions";
      const body: any = { targetUserId };
      if (action === "delete_orders") fnName = "admin-delete-orders";
      else if (action === "mark_as_recurrent") fnName = "admin-mark-as-recurrent";
      else { body.action = action; body.redirectTo = "https://dk-l-andpage.vercel.app/login"; }

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clients", page, search], exact: true });
      showSuccess(data?.message || "Ação realizada com sucesso!");
      setActionToConfirm(null);
    },
    onError: (err: Error) => showError(`Erro: ${err.message}`),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total:{" "}
            <span className="font-semibold text-primary">
              {total.toLocaleString("pt-BR")}
            </span>
            {!search && (
              <span className="ml-2 text-xs text-muted-foreground">
                — Página {page} de {maxPage}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por email..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-md text-sm w-60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          {/* New client */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Cadastro de Cliente</DialogTitle>
              </DialogHeader>
              <CreateClientForm
                onSubmit={(v) => createMutation.mutate(v)}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          {/* Flagged filter */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Switch
              id="filter-flagged"
              checked={showFlagged}
              onCheckedChange={setShowFlagged}
            />
            <Label htmlFor="filter-flagged" className="text-sm cursor-pointer">
              Apenas alertas
            </Label>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {page} / {maxPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              disabled={page >= maxPage || isFetching}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status Compra</TableHead>
              <TableHead>Segurança (Exigir PIX)</TableHead>
              <TableHead>Cliente Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-red-500 mb-3 text-sm">{(error as Error).message}</p>
                  <Button size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium text-sm">{client.email}</TableCell>
                  <TableCell className="text-sm">
                    {client.first_name || "-"} {client.last_name || ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit text-xs">
                        Total: {client.order_count} pedido(s)
                      </Badge>
                      {client.completed_order_count > 0 ? (
                        <Badge className="bg-green-500 hover:bg-green-600 w-fit text-xs">
                          Recorrente ({client.completed_order_count})
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit text-xs">
                          Primeira Compra
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={client.force_pix_on_next_purchase}
                        onCheckedChange={(checked) =>
                          togglePixMutation.mutate({ userId: client.id, forcePix: checked })
                        }
                        disabled={togglePixMutation.isPending}
                      />
                      <span
                        className={`text-xs font-bold ${
                          client.force_pix_on_next_purchase ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {client.force_pix_on_next_purchase ? "PIX OBRIGATÓRIO" : "CARTÃO LIBERADO"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {client.created_at
                        ? new Date(client.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-blue-600"
                        onClick={() => {
                          setSelectedClient(client);
                          setIsDetailsOpen(true);
                        }}
                        title="Ver Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Ações</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>

                          <DropdownMenuItem
                            onSelect={() =>
                              togglePixMutation.mutate({
                                userId: client.id,
                                forcePix: !client.force_pix_on_next_purchase,
                              })
                            }
                            disabled={togglePixMutation.isPending}
                            className={
                              client.force_pix_on_next_purchase ? "text-green-600" : "text-red-600"
                            }
                          >
                            {client.force_pix_on_next_purchase ? (
                              <><Unlock className="h-4 w-4 mr-2" /><span>Liberar Cartão</span></>
                            ) : (
                              <><Lock className="h-4 w-4 mr-2" /><span>Exigir PIX</span></>
                            )}
                          </DropdownMenuItem>

                          {client.completed_order_count === 0 && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setActionToConfirm({ action: "mark_as_recurrent", client })
                              }
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span>Marcar como Recorrente</span>
                            </DropdownMenuItem>
                          )}

                          {client.order_count > 0 && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setActionToConfirm({ action: "delete_orders", client })
                              }
                              className="text-red-600"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              <span>Redefinir Status Compra</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onSelect={() =>
                              setActionToConfirm({ action: "resend_confirmation", client })
                            }
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Reenviar Confirmação</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={() =>
                              setActionToConfirm({ action: "send_password_reset", client })
                            }
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            <span>Redefinir Senha</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm action */}
      <AlertDialog open={!!actionToConfirm} onOpenChange={() => setActionToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm?.action === "resend_confirmation"
                ? `Reenviar e-mail de confirmação para ${actionToConfirm.client.email}?`
                : actionToConfirm?.action === "send_password_reset"
                ? `Enviar link de redefinição de senha para ${actionToConfirm.client.email}?`
                : actionToConfirm?.action === "mark_as_recurrent"
                ? `Marcar ${actionToConfirm.client.email} como recorrente?`
                : `ATENÇÃO: Deletar TODOS OS PEDIDOS de ${actionToConfirm?.client.email}? Esta ação é irreversível.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                actionToConfirm &&
                actionMutation.mutate({
                  action: actionToConfirm.action,
                  targetUserId: actionToConfirm.client.id,
                })
              }
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? "Executando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client details */}
      <ClientDetailsModal
        client={selectedClient}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Mail, KeyRound, RotateCcw, CheckCircle, Lock, Unlock, UserPlus, Eye, CalendarDays } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
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
  role: 'user' | 'adm';
  force_pix_on_next_purchase: boolean;
  order_count: number;
  completed_order_count: number;
}

// Accept options for limit, page and search so we can fetch paged results
const fetchClients = async (options?: { limit?: number; page?: number; search?: string }): Promise<Client[]> => {
  console.log('[Clients.tsx] Iniciando fetchClients', options);

  try {
    const body: any = {};
    if (options?.limit) body.limit = options.limit;
    if (options?.page) body.page = options.page;
    if (options?.search) body.search = options.search;

    console.log('[Clients.tsx] Chamando Edge Function via supabase.functions.invoke("get-users") com body:', body);
    const { data, error } = await supabase.functions.invoke('get-users', {
      body: Object.keys(body).length ? body : undefined,
    });

    if (error) {
      console.error('[Clients.tsx] Erro retornado pela Edge Function (invoke):', error);
      throw error;
    }

    if (!data) {
      console.warn('[Clients.tsx] Edge Function retornou sem dados.');
      throw new Error('Edge Function retornou sem dados.');
    }

    console.log('[Clients.tsx] Clientes carregados com sucesso (via Edge Function invoke), quantidade:', Array.isArray(data) ? data.length : 'n/a');
    return data as Client[];
  } catch (err) {
    console.error('[Clients.tsx] Falha ao chamar Edge Function via invoke, aplicando fallback para carregar profiles diretamente:', err);

    try {
      console.log('[Clients.tsx] Fallback: buscando profiles diretamente do Supabase');
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, role, force_pix_on_next_purchase, created_at, updated_at');

      // Apply range if page and limit provided to keep fallback lightweight
      if (options?.limit && options?.page) {
        const start = (options.page - 1) * options.limit;
        const end = start + options.limit - 1;
        // @ts-ignore
        query = query.range(start, end);
      } else if (options?.limit) {
        // @ts-ignore
        query = query.limit(options.limit);
      }

      // Fallback cannot reliably search by email because emails are stored in auth.users schema
      // which is not accessible from client due to RLS. We log a warning when search is requested.
      if (options?.search) {
        console.warn('[Clients.tsx] Fallback não suporta busca por email no cliente. A Edge Function deve ser usada para pesquisa.');
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) {
        console.error('[Clients.tsx] Erro ao buscar profiles no fallback:', profilesError);
        throw new Error(`Falha no fallback: ${profilesError.message}`);
      }

      const clientsFallback: Client[] = (profiles || []).map((p: any) => ({
        id: p.id,
        email: p.id ? `${p.id}@no-email.local` : '—',
        created_at: p.created_at || null,
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase === true,
        order_count: 0,
        completed_order_count: 0,
      }));

      console.log('[Clients.tsx] Clientes carregados com sucesso via fallback, quantidade:', clientsFallback.length);
      return clientsFallback;
    } catch (fallbackErr) {
      console.error('[Clients.tsx] Fallback falhou também:', fallbackErr);
      throw fallbackErr;
    }
  }
};

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10; // items per page

  // Estado para o modal de detalhes
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Guarda detalhes brutos do erro da Edge Function para exibição (apenas para depuração)
  const [rawEdgeError, setRawEdgeError] = useState<any>(null);
  
  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent';
    client: Client;
  } | null>(null);

  // Total real de clientes direto do banco
  const { data: totalClients } = useQuery<number>({
    queryKey: ["clientsTotal"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "user");
      if (error) throw error;
      return count || 0;
    },
  });

  // Reset to first page when user starts a new search
  useEffect(() => {
    setPage(1);
  }, [searchEmail]);

  const fetchOptions = {
    limit: pageSize,
    page,
    search: searchEmail && searchEmail.trim().length > 0 ? searchEmail.trim() : undefined,
  } as { limit?: number; page?: number; search?: string };

  const { data: clients, isLoading, error, refetch } = useQuery<Client[]>({
    queryKey: ["clients", page, searchEmail],
    queryFn: async () => {
      try {
        const data = await fetchClients(fetchOptions);
        setRawEdgeError(null);
        return data;
      } catch (e: any) {
        setRawEdgeError(e?.context ?? e);
        throw e;
      }
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (values: any) => {
        // Pega o token da sessão atual
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        // Fallback: se o token de sessão não existir ou estiver expirado, permita usar um token administrativo temporário
        // (veja instruções: defina a mesma string em localStorage com a chave 'ADMIN_CREATE_TOKEN' e como secret nas Edge Functions)
        const adminTokenFallback = typeof window !== 'undefined' ? window.localStorage.getItem('ADMIN_CREATE_TOKEN') : null;
        const authHeader = token ? `Bearer ${token}` : adminTokenFallback ? `Bearer ${adminTokenFallback}` : null;
        if (!authHeader) throw new Error("Sessão expirada. Faça login novamente ou configure o token administrativo temporário.");

        const response = await fetch(
          "https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/admin-create-user",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM",
            },
            body: JSON.stringify(values),
          }
        );

        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.details || result.error || `Erro ${response.status}`);
        }
        return result;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["clientsTotal"] });
        showSuccess("Cliente criado com sucesso!");
        setIsCreateModalOpen(false);
    },
    onError: (error: Error) => {
        showError(`Erro ao criar cliente: ${error.message}`);
    },
  });

  const toggleSecurityMutation = useMutation({
    mutationFn: async ({ userId, forcePix }: { userId: string; forcePix: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ force_pix_on_next_purchase: forcePix })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    },
    onMutate: async (variables) => {
      // optimistic update clients list for the current page/search
      await queryClient.cancelQueries({ queryKey: ["clients", page, searchEmail] });
      const previous = queryClient.getQueryData<Client[]>(["clients", page, searchEmail]);
      if (previous) {
        queryClient.setQueryData(["clients", page, searchEmail], previous.map(c => c.id === variables.userId ? { ...c, force_pix_on_next_purchase: variables.forcePix } : c));
      }
      return { previous };
    },
    onSuccess: (_, variables) => {
      // Invalidate queries so UI and other pages reflect the change
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplierOrders"] });
      queryClient.invalidateQueries({ queryKey: ["selectableItemsForSupplierOrder"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      showSuccess(variables.forcePix ? "Restrição de PIX ativada!" : "Venda via Cartão liberada!");
    },
    onError: (error: Error, variables, context: any) => {
      // rollback optimistic update
      if (context?.previous) {
        queryClient.setQueryData(["clients", page, searchEmail], context.previous);
      }
      showError(`Erro ao atualizar segurança: ${error.message}`);
    },
  });

  const userActionMutation = useMutation({
    mutationFn: async ({ action, targetUserId }: { action: string; targetUserId: string }) => {
      let functionName = '';
      let body: any = { targetUserId };

      if (action === 'delete_orders') {
        functionName = 'admin-delete-orders';
      } else if (action === 'mark_as_recurrent') {
        functionName = 'admin-mark-as-recurrent';
      } else {
        functionName = 'admin-user-actions';
        body.action = action;
        body.redirectTo = 'https://dk-l-andpage.vercel.app/login'; 
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });
      
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
            const errorJson = await error.context.json();
            if (errorJson.details) throw new Error(errorJson.details);
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setActionToConfirm(null);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  });

  const handleConfirmAction = () => {
    if (actionToConfirm) {
      userActionMutation.mutate({
        action: actionToConfirm.action,
        targetUserId: actionToConfirm.client.id,
      });
    }
  };

  // Keep client-side filtering light: only exclude admins and apply the flagged filter here.
  // Search is performed server-side when a search term is provided.
  const filteredClients = clients?.filter(client => {
    if (client.role === 'adm') return false;
    if (showOnlyFlagged && !client.force_pix_on_next_purchase) return false;
    return true;
  });

  const maxPage = totalClients ? Math.max(1, Math.ceil(totalClients / pageSize)) : undefined;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total de clientes cadastrados: <span className="font-semibold text-primary">{totalClients?.toLocaleString("pt-BR") || filteredClients?.length || 0}</span>
            {!searchEmail && (
              <span className="text-xs text-muted-foreground ml-2">(Mostrando página {page}{maxPage ? ` de ${maxPage}` : ''})</span>
            )}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por email..."
              value={searchEmail}
              onChange={(e) => { setSearchEmail(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                    <UserPlus className="w-4 h-4 mr-2" /> Novo Cliente
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Criar Cadastro de Cliente</DialogTitle>
                </DialogHeader>
                <CreateClientForm 
                    onSubmit={(v) => createClientMutation.mutate(v)} 
                    isSubmitting={createClientMutation.isPending} 
                />
            </DialogContent>
          </Dialog>

          <div className="flex items-center space-x-2 border-l pl-4">
            <Switch
                id="filter-flagged"
                checked={showOnlyFlagged}
                onCheckedChange={setShowOnlyFlagged}
            />
            <Label htmlFor="filter-flagged" className="text-sm">Apenas alertas</Label>
          </div>

          {/* Pagination controls */}
          <div className="pl-4 flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Anterior
            </Button>

            <div className="text-sm text-muted-foreground">Página {page}{maxPage ? ` de ${maxPage}` : ''}</div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading || (totalClients ? page >= (maxPage || 1) : (clients ? clients.length < pageSize : true))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

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
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-red-500">
                  <div className="space-y-3">
                    <div>Erro ao carregar clientes:</div>
                    <div className="text-sm text-red-600">{(error as Error)?.message}</div>
                    <div className="flex items-center justify-center space-x-2">
                      <Button onClick={() => refetch()}>Tentar novamente</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (rawEdgeError) {
                            const payload = typeof rawEdgeError === 'string' ? rawEdgeError : JSON.stringify(rawEdgeError, null, 2);
                            navigator.clipboard?.writeText(payload);
                            showSuccess('Detalhes do erro copiados para a área de transferência.');
                          } else {
                            navigator.clipboard?.writeText((error as Error)?.message || 'No details');
                            showSuccess('Mensagem de erro copiada.');
                          }
                        }}
                      >
                        Copiar Debug
                      </Button>
                    </div>

                    {rawEdgeError && (
                      <div className="mt-2 text-left">
                        <div className="text-xs text-muted-foreground mb-1">Detalhes brutos da Edge Function (para depuração):</div>
                        <pre className="max-h-48 overflow-auto bg-gray-100 p-2 rounded text-xs">
                          {typeof rawEdgeError === 'string' ? rawEdgeError : JSON.stringify(rawEdgeError, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Dica: abra o DevTools (Console) para ver logs adicionais. Eu já escrevo detalhes no console ao chamar a Edge Function.
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.email}</TableCell>
                  <TableCell>{client.first_name || '-'} {client.last_name || ''}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline">Total: {client.order_count} Pedido(s)</Badge>
                      {client.completed_order_count > 0 ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          Recorrente ({client.completed_order_count} Concluído(s))
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Primeira Compra</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={client.force_pix_on_next_purchase}
                        onCheckedChange={(checked) => toggleSecurityMutation.mutate({ userId: client.id, forcePix: checked })}
                        disabled={toggleSecurityMutation.isPending}
                      />
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${client.force_pix_on_next_purchase ? 'text-red-600' : 'text-green-600'}`}>
                          {client.force_pix_on_next_purchase ? "PIX OBRIGATÓRIO" : "CARTÃO LIBERADO"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="w-3 h-3" />
                        {client.created_at 
                          ? new Date(client.created_at).toLocaleDateString("pt-BR") 
                          : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-gray-500 hover:text-blue-600"
                            onClick={() => { setSelectedClient(client); setIsDetailsModalOpen(true); }}
                            title="Ver Detalhes do Cliente"
                        >
                            <Eye className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu de ações</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>
                            
                            <DropdownMenuItem
                                onSelect={() => toggleSecurityMutation.mutate({ userId: client.id, forcePix: !client.force_pix_on_next_purchase })}
                                disabled={toggleSecurityMutation.isPending}
                                className={client.force_pix_on_next_purchase ? "text-green-600" : "text-red-600"}
                            >
                                {client.force_pix_on_next_purchase ? (
                                    <><Unlock className="h-4 w-4 mr-2" /><span>Liberar Cartão</span></>
                                ) : (
                                    <><Lock className="h-4 w-4 mr-2" /><span>Exigir PIX (Bloquear Cartão)</span></>
                                )}
                            </DropdownMenuItem>

                            {client.completed_order_count === 0 && (
                            <DropdownMenuItem
                                onSelect={() => setActionToConfirm({ action: 'mark_as_recurrent', client })}
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                <span>Marcar como Recorrente</span>
                            </DropdownMenuItem>
                            )}
                            {client.order_count > 0 && (
                            <DropdownMenuItem
                                onSelect={() => setActionToConfirm({ action: 'delete_orders', client })}
                                className="text-red-600"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                <span>Redefinir Status Compra</span>
                            </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                            onSelect={() => setActionToConfirm({ action: 'resend_confirmation', client })}
                            >
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Reenviar Confirmação</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                            onSelect={() => setActionToConfirm({ action: 'send_password_reset', client })}
                            >
                            <KeyRound className="mr-2 h-4 w-4" />
                            <span>Enviar Redefinição de Senha</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmação de Ações e Novo Cadastro */}
      <AlertDialog open={!!actionToConfirm} onOpenChange={() => setActionToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm?.action === 'resend_confirmation'
                ? `Você tem certeza que deseja reenviar o e-mail de confirmação para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === 'send_password_reset'
                ? `Você tem certeza que deseja enviar um link de redefinição de senha para ${actionToConfirm?.client.email}?`
                : actionToConfirm?.action === 'mark_as_recurrent'
                ? `Você tem certeza que deseja marcar o cliente ${actionToConfirm?.client.email} como recorrente? Isso removerá a restrição de PIX e permitirá outros métodos de pagamento.`
                : `ATENÇÃO: Você está prestes a DELETAR PERMANENTEMENTE TODOS OS PEDIDOS do cliente ${actionToConfirm?.client.email}. Isso redefinirá o status de compra dele para 'Primeira Compra'. Esta ação é irreversível.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={userActionMutation.isPending}
            >
              {userActionMutation.isPending ? "Executando..." : "Sim, Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Detalhes do Cliente */}
      <ClientDetailsModal 
        client={selectedClient} 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
      />
    </div>
  );
};

export default ClientsPage;
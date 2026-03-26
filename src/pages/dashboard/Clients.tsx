import { useState } from "react";
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

const fetchClients = async (): Promise<Client[]> => {
  console.log('[Clients.tsx] Iniciando fetchClients');
  
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  console.log('[Clients.tsx] Token encontrado:', !!token);
  
  if (!token) throw new Error('Usuário não autenticado. Faça login novamente.');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const functionUrl = `${SUPABASE_URL}/functions/v1/get-users`;
  
  console.log('[Clients.tsx] URL da função:', functionUrl);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[Clients.tsx] Status da resposta:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Clients.tsx] Erro na resposta:', response.status, errorText);
      throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao buscar clientes'}`);
    }

    const data = await response.json();
    console.log('[Clients.tsx] Clientes carregados com sucesso (via Edge Function), quantidade:', Array.isArray(data) ? data.length : 'n/a');
    return data;
  } catch (err) {
    console.error('[Clients.tsx] Erro ao chamar Edge Function, aplicando fallback para carregar profiles diretamente:', err);

    // Fallback: buscar profiles diretamente (pode não incluir email)
    try {
      console.log('[Clients.tsx] Fallback: buscando profiles diretamente do Supabase');
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, force_pix_on_next_purchase, created_at, updated_at');

      if (profilesError) {
        console.error('[Clients.tsx] Erro ao buscar profiles no fallback:', profilesError);
        throw new Error(`Falha no fallback: ${profilesError.message}`);
      }

      // Mapear profiles para o tipo Client (preenchendo campos que não existem com placeholders)
      const clientsFallback: Client[] = (profiles || []).map((p: any) => ({
        id: p.id,
        // Email não está na tabela profiles por padrão — mostramos um placeholder para visualização
        email: p.id ? `${p.id}@no-email.local` : '—',
        created_at: p.created_at || null,
        updated_at: p.updated_at || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: p.role || 'user',
        force_pix_on_next_purchase: p.force_pix_on_next_purchase || false,
        // Não temos acesso aos pedidos via cliente (RLS), então deixamos 0
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Estado para o modal de detalhes
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Guarda detalhes brutos do erro da Edge Function para exibição (apenas para depuração)
  const [rawEdgeError, setRawEdgeError] = useState<any>(null);
  
  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent';
    client: Client;
  } | null>(null);

  const { data: clients, isLoading, error, refetch } = useQuery<Client[]>({
    queryKey: ["clients"],
    // wrapper para capturar detalhes brutos do erro e colocá-los no estado para exibição
    queryFn: async () => {
      try {
        const data = await fetchClients();
        setRawEdgeError(null);
        return data;
      } catch (e: any) {
        // Conservar qualquer informação extra (context, status, etc.) enviada pelo client/edge function
        // para que possamos exibir no UI para depuração.
        setRawEdgeError(e?.context ?? e);
        throw e;
      }
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (values: any) => {
        const { data, error } = await supabase.functions.invoke("create-client-by-admin", {
            body: values,
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
      // optimistic update clients list
      await queryClient.cancelQueries({ queryKey: ["clients"] });
      const previous = queryClient.getQueryData<Client[]>(["clients"]);
      if (previous) {
        queryClient.setQueryData(["clients"], previous.map(c => c.id === variables.userId ? { ...c, force_pix_on_next_purchase: variables.forcePix } : c));
      }
      return { previous };
    },
    onSuccess: (_, variables) => {
      // Invalidate a broader set so UI and other pages reflect the change
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
        queryClient.setQueryData(["clients"], context.previous);
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

  const filteredClients = clients?.filter(client => {
    if (client.role === 'adm') return false;
    return !showOnlyFlagged || client.force_pix_on_next_purchase;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold">Clientes</h1>
        
        <div className="flex flex-wrap items-center gap-2">
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
                          // Expõe instrução simples para o usuário inspecionar o console
                          // e facilita cópia das informações brutas do erro (se existirem)
                          if (rawEdgeError) {
                            const payload = typeof rawEdgeError === 'string' ? rawEdgeError : JSON.stringify(rawEdgeError, null, 2);
                            navigator.clipboard?.writeText(payload);
                            showSuccess('Detalhes do erro copiados para a área de transferência.');
                          } else {
                            // Caso não haja dados brutos, copia apenas a mensagem
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
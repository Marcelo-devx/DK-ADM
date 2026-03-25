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
import { X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  // Optional profile fields used by the validation UI
  phone?: string | null;
  cpf_cnpj?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  role: 'user' | 'adm';
  force_pix_on_next_purchase: boolean;
  order_count: number;
  completed_order_count: number;
  accepted_terms_at: string | null;
  is_fully_verified?: boolean;
}

const fetchClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase.functions.invoke('get-users');
  
  if (error) {
    throw new Error(error.message || 'Erro ao buscar clientes');
  }
  
  return data || [];
};

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Estado para o modal de detalhes
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Helper: retorna array de campos faltantes e função para checar cada campo (labels em pt-BR)
  const getMissingFields = (client: Client) => {
    const required: { key: keyof Client; label: string }[] = [
      { key: "first_name", label: "Nome" },
      { key: "last_name", label: "Sobrenome" },
      { key: "phone", label: "Telefone" },
      { key: "cpf_cnpj", label: "CPF/CNPJ" },
      { key: "street", label: "Rua" },
      { key: "number", label: "Número" },
      { key: "neighborhood", label: "Bairro" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
      { key: "cep", label: "CEP" },
      { key: "date_of_birth", label: "Data de Nascimento" },
      { key: "gender", label: "Gênero" },
      { key: "accepted_terms_at", label: "Aceitou Termos" },
    ];

    const missing = required.filter(({ key }) => {
      const val = (client as any)[key];
      return val === null || val === undefined || val === "";
    }).map(r => r.label);
    return missing;
  };

  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent';
    client: Client;
  } | null>(null);

  const { data: clients, isLoading, error, refetch } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: fetchClients,
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
                  <div className="space-y-2">
                    <div>Erro ao carregar clientes:</div>
                    <div className="text-sm text-red-600">{(error as Error)?.message}</div>
                    <div className="flex justify-center">
                      <Button onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        {client.is_fully_verified ? (
                          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 h-5 flex items-center gap-1 cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] px-1.5 py-0.5 h-5 flex items-center gap-1 cursor-pointer">
                            <X className="w-3 h-3" />
                            Incompleto
                          </Badge>
                        )}
                      </PopoverTrigger>
                      <PopoverContent className="w-[20rem]">
                        <div className="text-sm">
                          <div className="font-medium mb-2">Validações</div>
                          {client.is_fully_verified ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="w-4 h-4" /> Todos os campos preenchidos (Verificado)
                            </div>
                          ) : (
                            (() => {
                              const missing = getMissingFields(client);
                              const allFields = [
                                "Nome",
                                "Sobrenome",
                                "Telefone",
                                "CPF/CNPJ",
                                "Rua",
                                "Número",
                                "Bairro",
                                "Cidade",
                                "Estado",
                                "CEP",
                                "Data de Nascimento",
                                "Gênero",
                                "Aceitou Termos",
                              ];
                              return (
                                <div className="space-y-1">
                                  {allFields.map((label) => {
                                    const isMissing = missing.includes(label);
                                    return (
                                      <div key={label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {isMissing ? (
                                            <X className="w-4 h-4 text-red-500" />
                                          ) : (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                          )}
                                          <span className={isMissing ? "text-sm text-red-600" : "text-sm text-green-600"}>
                                            {label}
                                          </span>
                                        </div>
                                        {isMissing ? <span className="text-xs text-muted-foreground">Faltando</span> : <span className="text-xs text-muted-foreground">OK</span>}
                                      </div>
                                    );
                                  })}
                                  {missing.length === 0 && <div className="text-sm text-green-600">Nenhum campo faltante</div>}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <span>{client.email}</span>
                  </TableCell>
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
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
import { ShieldAlert, Edit, MoreHorizontal, Mail, KeyRound, ShoppingCart, RotateCcw, CheckCircle, Lock, Unlock, UserPlus, Upload, FileUp, FileDown } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showSuccess, showError } from "@/utils/toast";
import { CreateClientForm } from "@/components/dashboard/CreateClientForm";
import * as XLSX from 'xlsx';
import { mapRowKeys } from "@/utils/excel-utils";
import { ClientImportModal } from "@/components/dashboard/ClientImportModal";

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
  const { data, error } = await supabase.functions.invoke("get-users");
  if (error) {    
    throw new Error(`Falha ao buscar clientes: ${error.message}`);
  }
  return data;
};

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent';
    client: Client;
  } | null>(null);

  // States for Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [clientsToImport, setClientsToImport] = useState<any[]>([]);

  const { data: clients, isLoading, error } = useQuery<Client[]>({
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

  const bulkImportMutation = useMutation({
    mutationFn: async (clients: any[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-import-clients", { 
        body: { clients } 
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setIsImportModalOpen(false);
      setClientsToImport([]);
    },
    onError: (error: Error) => {
      showError(`Erro na importação: ${error.message}`);
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(variables.forcePix ? "Restrição de PIX ativada!" : "Venda via Cartão liberada!");
    },
    onError: (error: Error) => {
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

  const handleImportXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        // Mapeia as chaves do Excel para o formato esperado
        const mappedClients = json.map(mapRowKeys).map((row: any) => ({
            email: row.email,
            first_name: row.nome || '',
            last_name: row.sobrenome || '',
            phone: row.telefone ? String(row.telefone) : '',
            cep: row.cep ? String(row.cep) : '',
            street: row.rua || '',
            number: row.numero ? String(row.numero) : '',
            complement: row.complemento || '',
            neighborhood: row.bairro || '',
            city: row.cidade || '',
            state: row.estado || '',
            password: row.senha ? String(row.senha) : undefined, // Opcional
        })).filter((c: any) => c.email && c.email.includes('@')); // Filtro básico

        if (mappedClients.length === 0) {
            showError("Nenhum cliente válido encontrado na planilha. Verifique a coluna 'Email'.");
            return;
        }

        setClientsToImport(mappedClients);
        setIsImportModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = [
        "Email", "Senha", "Nome", "Sobrenome", "Telefone", "CEP", "Rua", "Numero", "Complemento", "Bairro", "Cidade", "Estado"
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "modelo_importacao_clientes.xlsx");
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
          {/* Botões de Importação */}
          <div className="flex items-center gap-2 mr-4">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleDownloadTemplate}>
                            <FileDown className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar Modelo de Planilha</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => document.getElementById('client-import-input')?.click()}>
                            <FileUp className="h-4 w-4" />
                            <input type="file" id="client-import-input" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Importar Excel</TooltipContent>
                </Tooltip>
            </TooltipProvider>
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
              <TableHead>Data da Alteração</TableHead>
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
                  Erro ao carregar clientes.
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
                    {client.updated_at 
                      ? new Date(client.updated_at).toLocaleString("pt-BR") 
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
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

      {/* Modal de Importação */}
      <ClientImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        clientsToImport={clientsToImport} 
        onConfirm={() => bulkImportMutation.mutate(clientsToImport)}
        isSubmitting={bulkImportMutation.isPending}
      />
    </div>
  );
};

export default ClientsPage;
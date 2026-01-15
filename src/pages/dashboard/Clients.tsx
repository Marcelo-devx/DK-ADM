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
import { MoreHorizontal, Mail, KeyRound, RotateCcw, CheckCircle, Lock, Unlock, UserPlus, User, Calendar } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  email: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  role: 'user' | 'adm';
  force_pix_on_next_purchase: boolean;
  order_count: number;
  completed_order_count: number;
}

const fetchClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase.functions.invoke("get-users");
  if (error) throw new Error(error.message);
  
  // Como a função get-users não retorna todos os campos nativamente, vamos complementar com os profiles
  const { data: profiles } = await supabase.from('profiles').select('id, gender, date_of_birth');
  const profilesMap = new Map(profiles?.map(p => [p.id, p]));

  return data.map((u: any) => ({
      ...u,
      gender: profilesMap.get(u.id)?.gender || null,
      date_of_birth: profilesMap.get(u.id)?.date_of_birth || null,
  }));
};

const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<{
    action: 'resend_confirmation' | 'send_password_reset' | 'delete_orders' | 'mark_as_recurrent';
    client: Client;
  } | null>(null);

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
        body.redirectTo = 'https://dk-l-andpage.vercel.app/login'; 
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setActionToConfirm(null);
    },
    onError: (error: Error) => showError(`Erro: ${error.message}`),
  });

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
              <TableHead>Cliente</TableHead>
              <TableHead>Perfil (BI)</TableHead>
              <TableHead>Status Compra</TableHead>
              <TableHead>Segurança (Exigir PIX)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ))
            ) : filteredClients?.map((client) => {
                const age = calculateAge(client.date_of_birth);
                return (
                <TableRow key={client.id}>
                  <TableCell>
                      <div className="flex flex-col">
                          <span className="font-bold text-sm">{client.first_name || 'S/N'} {client.last_name || ''}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {client.email}</span>
                      </div>
                  </TableCell>
                  <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] gap-1 font-bold">
                            <User className="w-2.5 h-2.5" /> {client.gender || 'N/I'}
                        </Badge>
                        {age && (
                            <Badge variant="outline" className="text-[9px] gap-1 bg-gray-50">
                                <Calendar className="w-2.5 h-2.5" /> {age} anos
                            </Badge>
                        )}
                      </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="secondary" className="text-[9px] w-fit">Total: {client.order_count}</Badge>
                      {client.completed_order_count > 0 ? (
                        <Badge className="bg-green-500 text-[9px] w-fit">Recorrente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] w-fit">Primeira Compra</Badge>
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
                      <span className={cn("text-[10px] font-black uppercase", client.force_pix_on_next_purchase ? 'text-red-600' : 'text-green-600')}>
                        {client.force_pix_on_next_purchase ? "PIX" : "LIBERADO"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setActionToConfirm({ action: 'send_password_reset', client })}><KeyRound className="mr-2 h-4 w-4" />Redefinir Senha</DropdownMenuItem>
                        {client.order_count > 0 && (
                          <DropdownMenuItem onSelect={() => setActionToConfirm({ action: 'delete_orders', client })} className="text-red-600"><RotateCcw className="mr-2 h-4 w-4" />Redefinir Compras</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!actionToConfirm} onOpenChange={() => setActionToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToConfirm?.action === 'send_password_reset'
                ? `Enviar link de redefinição de senha para ${actionToConfirm?.client.email}?`
                : `ATENÇÃO: Você vai DELETAR TODOS OS PEDIDOS de ${actionToConfirm?.client.email}. Ele voltará a ser 'Primeira Compra'.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => actionToConfirm && userActionMutation.mutate({ action: actionToConfirm.action, targetUserId: actionToConfirm.client.id })}>Sim, Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsPage;
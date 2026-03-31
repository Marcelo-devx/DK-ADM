import { useState } from "react";
import { useClients } from "@/hooks/useClients";
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
// Use relative imports so TS reliably finds these files
import SearchBar from "../../components/dashboard/clients/SearchBar";
import CreateClientModal from "../../components/dashboard/clients/CreateClientModal";
import ClientsTable from "../../components/dashboard/clients/ClientsTable";
import { ClientDetailsModal } from "../../components/dashboard/ClientDetailsModal";
import ClientPreview from "../../components/dashboard/clients/ClientPreview";

export default function ClientsPage() {
  const {
    page,
    setPage,
    total,
    visibleClients,
    isLoading,
    isFetching,
    searchInput,
    setSearchInput,
    searchNow,
    search,
    clients,
    isLoading: clientsLoading,
    create,
    createStatus,
    togglePix,
    togglePixStatus,
    action,
    actionStatus,
    refetch,
  } = useClients(1);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<any | null>(null);

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
                — Página {page} de {Math.max(1, Math.ceil(total / 10))}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            showFlagged={false}
            onToggleFlagged={() => {}}
            onOpenCreate={() => setIsCreateOpen(true)}
            isCreating={createStatus.isPending}
            onSearchSubmit={(v) => searchNow(v)}
          />
        </div>
      </div>

      {/* If user is actively searching, show a focused preview for the matched client */}
      {search ? (
        clients && clients.length > 0 ? (
          <ClientPreview client={clients[0]} onOpenDetails={(c) => { setSelectedClient(c); setIsDetailsOpen(true); }} />
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-muted-foreground">Nenhum cliente encontrado para: <span className="font-bold">{searchInput}</span></p>
          </div>
        )
      ) : (
        <ClientsTable
          clients={visibleClients}
          isLoading={clientsLoading}
          toggleLoading={togglePixStatus.isPending}
          onTogglePix={(id, val) => togglePix({ userId: id, forcePix: val })}
          onOpenDetails={(c) => { setSelectedClient(c); setIsDetailsOpen(true); }}
          onActionConfirm={(actionName, client) => setActionToConfirm({ action: actionName, client })}
        />
      )}

      <CreateClientModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={(v) => create(v)}
        isCreating={createStatus.isPending}
      />

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
                action(actionToConfirm.action, actionToConfirm.client.id)
              }
              disabled={actionStatus.isPending}
            >
              {actionStatus.isPending ? "Executando..." : "Confirmar"}
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
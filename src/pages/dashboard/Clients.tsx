import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { showSuccess, showError } from "@/utils/toast";
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
// Use relative imports so TS reliably finds these files
import SearchBar from "../../components/dashboard/clients/SearchBar";
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
    togglePix,
    togglePixStatus,
    action,
    actionStatus,
    refetch,
    pageSize,
    error,
  } = useClients(1);

  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<any | null>(null);

  const effectivePageSize = pageSize ?? 20;

  const showDebug = total > 0 && (!clients || clients.length === 0) && !search;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total: <span className="font-semibold text-primary">{total.toLocaleString("pt-BR")}</span>
            {!search && (
              <span className="ml-2 text-xs text-muted-foreground">
                — Página {page} de {Math.max(1, Math.ceil(total / effectivePageSize))}
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
            onSearchSubmit={(v) => searchNow(v)}
          />
        </div>
      </div>

      {/* Debug panel when total exists but no clients fetched */}
      {showDebug && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-yellow-800 font-medium">Detectado: total de clientes presente mas nenhum cliente retornado nesta página.</p>
              <p className="text-xs text-muted-foreground mt-1">Isso indica um problema na consulta (Edge Function indisponível ou RLS bloqueando as linhas).</p>
              <ul className="text-xs mt-2 text-muted-foreground">
                <li>page: <span className="font-medium">{page}</span></li>
                <li>pageSize: <span className="font-medium">{effectivePageSize}</span></li>
                <li>clients.length: <span className="font-medium">{clients?.length ?? 0}</span></li>
                <li>isLoading: <span className="font-medium">{String(isLoading)}</span></li>
                <li>isFetching: <span className="font-medium">{String(isFetching)}</span></li>
                <li>search: <span className="font-medium">{search || '(vazio)'}</span></li>
                <li>error: <span className="font-medium">{(error as any)?.message ?? String(error) ?? 'nenhum'}</span></li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 bg-primary text-white rounded"
                onClick={() => refetch()}
              >
                Recarregar lista
              </button>
              <button
                className="px-3 py-2 border rounded"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      )}

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
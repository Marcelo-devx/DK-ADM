import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { showSuccess, showError } from "@/utils/toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SearchBar from "../../components/dashboard/clients/SearchBar";
import ClientsTable from "../../components/dashboard/clients/ClientsTable";
import { ClientDetailsModal } from "../../components/dashboard/ClientDetailsModal";
import ClientPreview from "../../components/dashboard/clients/ClientPreview";
import { Client } from "@/hooks/useClients";
import { Ban, Trash2, AlertTriangle } from "lucide-react";

type PendingAction =
  | { type: "block"; client: Client }
  | { type: "delete"; client: Client }
  | { type: "generic"; action: string; client: Client };

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
    blockUser,
    blockUserStatus,
    deleteUser,
    deleteUserStatus,
    refetch,
  } = useClients(1);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const handleConfirm = () => {
    if (!pendingAction) return;

    if (pendingAction.type === "block") {
      blockUser(pendingAction.client.id, {
        onSuccess: () => {
          showSuccess(`Usuário ${pendingAction.client.email} bloqueado com sucesso.`);
          setPendingAction(null);
        },
        onError: (err: any) => {
          showError(err?.message || "Erro ao bloquear usuário.");
          setPendingAction(null);
        },
      });
    } else if (pendingAction.type === "delete") {
      deleteUser(pendingAction.client.id, {
        onSuccess: () => {
          showSuccess(`Usuário ${pendingAction.client.email} excluído permanentemente.`);
          setPendingAction(null);
        },
        onError: (err: any) => {
          showError(err?.message || "Erro ao excluir usuário.");
          setPendingAction(null);
        },
      });
    } else {
      action(
        { action: pendingAction.action, targetUserId: pendingAction.client.id },
        {
          onSuccess: () => setPendingAction(null),
          onError: (err: any) => {
            showError(err?.message || "Erro ao executar ação.");
            setPendingAction(null);
          },
        }
      );
    }
  };

  const isConfirming =
    blockUserStatus.isPending || deleteUserStatus.isPending || actionStatus.isPending;

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
            onSearchSubmit={(v) => searchNow(v)}
          />
        </div>
      </div>

      {/* If user is actively searching, show a focused preview for the matched client */}
      {search ? (
        clients && clients.length > 0 ? (
          <ClientPreview
            client={clients[0]}
            onOpenDetails={(c) => { setSelectedClient(c); setIsDetailsOpen(true); }}
            onBlockClient={(c) => setPendingAction({ type: "block", client: c })}
            onDeleteClient={(c) => setPendingAction({ type: "delete", client: c })}
          />
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
          onActionConfirm={(actionName, client) => {
            if (actionName === "block_user") {
              setPendingAction({ type: "block", client });
            } else if (actionName === "delete_user") {
              setPendingAction({ type: "delete", client });
            } else {
              setPendingAction({ type: "generic", action: actionName, client });
            }
          }}
        />
      )}

      {/* ── Confirm BLOCK ── */}
      <AlertDialog
        open={pendingAction?.type === "block"}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <Ban className="w-5 h-5" /> Bloquear Usuário
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a <strong>bloquear</strong> o usuário:
              </p>
              <p className="font-semibold text-foreground">
                {pendingAction?.type === "block" && pendingAction.client.email}
              </p>
              <p>
                O usuário <strong>não conseguirá mais fazer login</strong> na plataforma.
                Esta ação pode ser revertida pelo suporte.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isConfirming}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isConfirming ? "Bloqueando..." : "Sim, bloquear usuário"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm DELETE ── */}
      <AlertDialog
        open={pendingAction?.type === "delete"}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Excluir Usuário Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a <strong>excluir permanentemente</strong> o usuário:
              </p>
              <p className="font-semibold text-foreground">
                {pendingAction?.type === "delete" && pendingAction.client.email}
              </p>
              <p className="text-red-600 font-medium">
                ⚠️ ATENÇÃO: Esta ação é <strong>irreversível</strong>. Todos os dados do usuário
                (perfil, pedidos, histórico) serão removidos permanentemente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isConfirming}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {isConfirming ? "Excluindo..." : "Sim, excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm GENERIC actions ── */}
      <AlertDialog
        open={pendingAction?.type === "generic"}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "generic" && (
                pendingAction.action === "resend_confirmation"
                  ? `Reenviar e-mail de confirmação para ${pendingAction.client.email}?`
                  : pendingAction.action === "send_password_reset"
                  ? `Enviar link de redefinição de senha para ${pendingAction.client.email}?`
                  : pendingAction.action === "mark_as_recurrent"
                  ? `Marcar ${pendingAction.client.email} como recorrente?`
                  : `ATENÇÃO: Deletar TODOS OS PEDIDOS de ${pendingAction.client.email}? Esta ação é irreversível.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? "Executando..." : "Confirmar"}
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

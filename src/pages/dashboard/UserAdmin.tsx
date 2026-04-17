"use client";

import { useState } from "react";
import { useUserAdmin, PAGE_SIZE } from "@/hooks/useUserAdmin";
import { showSuccess, showError } from "@/utils/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Shield,
  ShieldX,
  Trash2,
  User as UserIcon,
  Calendar,
  Pencil,
  Mail,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
} from "lucide-react";
import { UserBlockModal } from "@/components/dashboard/UserBlockModal";
import { UserDeleteModal } from "@/components/dashboard/UserDeleteModal";
import { UserEditModal } from "@/components/dashboard/UserEditModal";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminUser, UpdateUserPayload } from "@/hooks/useUserAdmin";
import { useEffect, useRef } from "react";

function useDebounceValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function UserAdminPage() {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"block" | "unblock">("block");

  const searchTerm = useDebounceValue(searchInput, 400);

  const prevSearch = useRef(searchTerm);
  if (prevSearch.current !== searchTerm) {
    prevSearch.current = searchTerm;
    if (page !== 0) setPage(0);
  }

  const {
    searchUsers,
    countQuery,
    totalPages,
    blockUserMutation,
    deleteUserMutation,
    updateUserMutation,
  } = useUserAdmin(searchTerm, page);

  const users = searchUsers.data || [];
  const total = countQuery.data ?? 0;
  const isFetching = searchUsers.isFetching;

  // ── Block ──
  const handleBlockClick = (user: AdminUser) => {
    setSelectedUser(user);
    setActionType(user.is_blocked ? "unblock" : "block");
    setIsBlockModalOpen(true);
  };

  const handleBlockConfirm = async (reason: string) => {
    try {
      await blockUserMutation.mutateAsync({
        userId: selectedUser!.id,
        isBlocked: actionType === "block",
        reason,
      });
      showSuccess(
        actionType === "block"
          ? "Usuário bloqueado com sucesso"
          : "Usuário desbloqueado com sucesso"
      );
    } catch (error: any) {
      showError(error.message || "Erro ao realizar ação");
    }
  };

  // ── Delete ──
  const handleDeleteClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (deleteOrders: boolean, reason: string) => {
    try {
      await deleteUserMutation.mutateAsync({
        userId: selectedUser!.id,
        deleteOrders,
        reason,
      });
      showSuccess("Usuário excluído com sucesso");
    } catch (error: any) {
      showError(error.message || "Erro ao excluir usuário");
    }
  };

  // ── Edit ──
  const handleEditClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleEditConfirm = async (userId: string, payload: UpdateUserPayload) => {
    try {
      await updateUserMutation.mutateAsync({ userId, payload });
      showSuccess("Dados atualizados com sucesso");
    } catch (error: any) {
      showError(error.message || "Erro ao atualizar dados");
      throw error;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11)
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (cleaned.length === 14)
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return cpf;
  };

  const startItem = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const endItem = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Administração de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Gerencie o acesso e os dados dos usuários do sistema
        </p>
      </div>

      {/* Busca + contador */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, CPF ou telefone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Indicador de carregamento em background */}
        {isFetching && !searchUsers.isLoading && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Atualizando...</span>
          </div>
        )}

        {/* Contador total */}
        {!countQuery.isLoading && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-full">
            <Users className="h-3.5 w-3.5" />
            <span>
              {total.toLocaleString("pt-BR")} usuário{total !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searchUsers.isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {searchTerm
                    ? "Nenhum usuário encontrado para essa busca"
                    : "Nenhum usuário cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.is_blocked ? "bg-red-50/50" : ""}
                >
                  {/* Nome */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                        {user.first_name?.[0]?.toUpperCase() || (
                          <UserIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {user.first_name} {user.last_name}
                        </div>
                        {user.phone && (
                          <div className="text-xs text-muted-foreground truncate">
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    {user.email ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600 max-w-[200px]">
                        <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate" title={user.email}>
                          {user.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* CPF/CNPJ */}
                  <TableCell>
                    <code className="text-sm bg-slate-100 px-2 py-1 rounded font-mono">
                      {formatCPF(user.cpf_cnpj)}
                    </code>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {user.is_blocked ? (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldX className="h-3 w-3" />
                        Bloqueado
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <Shield className="h-3 w-3" />
                        Ativo
                      </Badge>
                    )}
                  </TableCell>

                  {/* Data */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(user.created_at)}
                    </div>
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(user)}
                        title="Editar dados do usuário"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleBlockClick(user)}
                        title={user.is_blocked ? "Desbloquear usuário" : "Bloquear usuário"}
                      >
                        {user.is_blocked ? (
                          <Shield className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldX className="h-4 w-4 text-red-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(user)}
                        title="Excluir usuário"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* ── Paginação ── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium">{startItem}–{endItem}</span> de{" "}
              <span className="font-medium">{total.toLocaleString("pt-BR")}</span> usuários
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>

              <span className="text-sm font-medium px-2">
                {page + 1} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UserBlockModal
        isOpen={isBlockModalOpen}
        onClose={() => { setIsBlockModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        isBlocking={actionType === "block"}
        onConfirm={handleBlockConfirm}
      />

      <UserDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        onConfirm={handleDeleteConfirm}
      />

      <UserEditModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        onConfirm={handleEditConfirm}
      />
    </div>
  );
}

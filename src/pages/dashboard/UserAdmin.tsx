"use client";

import { useState } from "react";
import { useUserAdmin } from "@/hooks/useUserAdmin";
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
  Mail,
} from "lucide-react";
import { UserBlockModal } from "@/components/dashboard/UserBlockModal";
import { UserDeleteModal } from "@/components/dashboard/UserDeleteModal";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserAdminPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"block" | "unblock">("block");

  const {
    searchUsers,
    blockUserMutation,
    deleteUserMutation,
  } = useUserAdmin(searchTerm);

  const filteredUsers = searchUsers.data || [];

  const handleBlockClick = (user: any) => {
    setSelectedUser(user);
    setActionType(user.is_blocked ? "unblock" : "block");
    setIsBlockModalOpen(true);
  };

  const handleBlockConfirm = async (reason: string) => {
    try {
      await blockUserMutation.mutateAsync({
        userId: selectedUser.id,
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

  const handleDeleteClick = (user: any) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async (deleteOrders: boolean, reason: string) => {
    try {
      await deleteUserMutation.mutateAsync({
        userId: selectedUser.id,
        deleteOrders,
        reason,
      });
      showSuccess("Usuário excluído com sucesso");
    } catch (error: any) {
      showError(error.message || "Erro ao excluir usuário");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Administração de Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Gerencie o acesso dos usuários ao sistema
        </p>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searchUsers.isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.is_blocked ? "bg-red-50/50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                        {user.first_name?.[0]?.toUpperCase() || <UserIcon className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.first_name} {user.last_name}
                        </div>
                        {user.email && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                      {user.id.slice(0, 8)}...
                    </code>
                  </TableCell>
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
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatDate(user.created_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
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
      </div>

      {/* Modals */}
      <UserBlockModal
        isOpen={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        isBlocking={actionType === "block"}
        onConfirm={handleBlockConfirm}
      />

      <UserDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

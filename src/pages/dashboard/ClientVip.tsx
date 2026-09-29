"use client";

import { useState } from "react";
import { useClientVip } from "@/hooks/useClientVip";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Search, User as UserIcon, Mail, MapPinOff } from "lucide-react";

export default function ClientVip() {
  const [searchInput, setSearchInput] = useState("");
  const { searchQuery, vipListQuery, setVipMutation } = useClientVip(searchInput);

  const results = searchQuery.data || [];
  const vipClients = vipListQuery.data || [];

  const handleToggleVip = async (userId: string, currentIsVip: boolean, name: string) => {
    try {
      await setVipMutation.mutateAsync({ userId, isVip: !currentIsVip });
      showSuccess(
        !currentIsVip
          ? `${name} agora é um cliente VIP.`
          : `${name} não é mais um cliente VIP.`
      );
    } catch (error: any) {
      showError(error.message || "Erro ao atualizar status VIP");
    }
  };

  const renderClientRow = (client: (typeof results)[number]) => {
    const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Sem nome";
    const isPending = setVipMutation.isPending && setVipMutation.variables?.userId === client.id;

    return (
      <div
        key={client.id}
        className="flex items-center justify-between gap-3 bg-white rounded-lg border p-3 flex-wrap"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
            {client.first_name?.[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate flex items-center gap-2">
              {name}
              {client.is_vip && (
                <Badge className="gap-1 bg-amber-500 text-white shrink-0">
                  <Crown className="h-3 w-3" /> VIP
                </Badge>
              )}
            </div>
            {client.email && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <Mail className="h-3 w-3 shrink-0" />
                {client.email}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={client.is_vip ? "outline" : "default"}
          className={client.is_vip ? "border-amber-500 text-amber-600 hover:bg-amber-50" : "bg-amber-500 hover:bg-amber-600"}
          disabled={isPending}
          onClick={() => handleToggleVip(client.id, client.is_vip, name)}
        >
          <Crown className="h-4 w-4 mr-1" />
          {isPending ? "Salvando..." : client.is_vip ? "Remover VIP" : "Tornar VIP"}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 shrink-0" />
          Cliente VIP
        </h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <MapPinOff className="h-3.5 w-3.5" />
          Clientes VIP podem finalizar compras mesmo com endereço fora da área de entrega cadastrada.
        </p>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente por nome, email ou CPF..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-2">
          {searchQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : searchInput.trim().length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Digite para buscar um cliente já cadastrado.
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum cliente encontrado para essa busca.
            </p>
          ) : (
            results.map(renderClientRow)
          )}
        </div>
      </div>

      {/* Lista de VIPs atuais */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Clientes VIP ativos ({vipClients.length})
        </h2>
        <div className="space-y-2">
          {vipListQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : vipClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 bg-white rounded-lg border">
              Nenhum cliente VIP cadastrado ainda.
            </p>
          ) : (
            vipClients.map(renderClientRow)
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useCallback } from "react";
import { Client } from "@/hooks/useClients";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ClientRow from "@/components/dashboard/clients/ClientRow";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  clients: Client[];
  isLoading: boolean;
  toggleLoading?: boolean;
  onTogglePix: (userId: string, forcePix: boolean) => void;
  onOpenDetails: (c: Client) => void;
  onActionConfirm: (action: string, client: Client) => void;
}

export default function ClientsTable({ clients, isLoading, toggleLoading, onTogglePix, onOpenDetails, onActionConfirm }: Props) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-primary font-bold">CPF/CNPJ</TableHead>
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
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                onTogglePix={onTogglePix}
                toggleLoading={toggleLoading}
                onOpenDetails={onOpenDetails}
                onActionConfirm={onActionConfirm}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
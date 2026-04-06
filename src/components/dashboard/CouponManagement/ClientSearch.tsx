"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { showError } from "@/utils/toast";
import { translateDatabaseError } from "@/utils/error-handler";

export interface ClientData {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
}

interface ClientSearchProps {
  onSelectClient: (client: ClientData) => void;
  selectedClient: ClientData | null;
}

export const ClientSearch = ({ onSelectClient, selectedClient }: ClientSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce para evitar muitas requisições
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Buscar clientes
  const { data: clients, isLoading, isError, refetch } = useQuery({
    queryKey: ["searchClients", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      console.log('[ClientSearch] Buscando clientes:', debouncedSearch);
      
      const { data, error } = await supabase.rpc("search_user_by_name_or_cpf", {
        p_search_term: debouncedSearch,
      });
      
      if (error) {
        console.error('[ClientSearch] Erro ao buscar clientes:', error);
        const translatedError = translateDatabaseError(error);
        throw new Error(translatedError);
      }
      
      console.log('[ClientSearch] Clientes encontrados:', data?.length || 0);
      return data as ClientData[];
    },
    enabled: debouncedSearch.length >= 2,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isError) {
      showError("Erro ao buscar clientes. Por favor, tente novamente.");
    }
  }, [isError]);

  const handleSelectClient = (client: ClientData) => {
    console.log('[ClientSearch] Cliente selecionado:', client);
    onSelectClient(client);
    setSearchTerm("");
  };

  const handleClear = () => {
    setSearchTerm("");
    onSelectClient(null as any);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar cliente por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Cliente selecionado */}
      {selectedClient && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </p>
                  <p className="text-xs text-gray-600">{selectedClient.email}</p>
                  {selectedClient.cpf_cnpj && (
                    <Badge variant="outline" className="text-[10px] mt-1">
                      CPF: {selectedClient.cpf_cnpj}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Remover
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de resultados */}
      {isLoading && debouncedSearch.length >= 2 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-600">Buscando clientes...</span>
        </div>
      )}

      {!isLoading && debouncedSearch.length >= 2 && clients && clients.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {clients.map((client) => (
            <Card
              key={client.user_id}
              className={cn(
                "cursor-pointer hover:bg-gray-50 transition-colors",
                selectedClient?.user_id === client.user_id ? "ring-2 ring-primary" : ""
              )}
              onClick={() => handleSelectClient(client)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {client.first_name} {client.last_name}
                      </p>
                      <p className="text-xs text-gray-600">{client.email}</p>
                      {client.cpf_cnpj && (
                        <p className="text-[10px] text-gray-500">CPF: {client.cpf_cnpj}</p>
                      )}
                    </div>
                  </div>
                  {selectedClient?.user_id === client.user_id && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && debouncedSearch.length >= 2 && clients && clients.length === 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span>Nenhum cliente encontrado com "{debouncedSearch}"</span>
            </div>
            <Button
              variant="link"
              className="w-full mt-2 text-sm"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
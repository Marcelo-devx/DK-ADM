"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  User, 
  Plus, 
  RefreshCw, 
  Phone,
  Mail,
  MapPin,
  Loader2,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Driver {
  id: string;
  name: string;
  displayName?: string;
  phone?: string;
  email?: string;
  status?: string;
  created_at: string;
}

const DriversManagementPage = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    phone: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Buscar motoristas
  const { data: drivers, isLoading, refetch } = useQuery({
    queryKey: ["spokeDrivers"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("spoke-proxy", {
        body: { action: "drivers", params: { maxPageSize: 100 } }
      });
      
      if (error) throw error;
      return data?.drivers || [];
    },
    refetchInterval: 60000,
  });

  // Criar motorista
  const createDriverMutation = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) {
        throw new Error("Digite o nome do motorista");
      }

      setIsSubmitting(true);
      
      const { error } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: "drivers",
          method: "POST",
          body: {
            name: formData.name,
            displayName: formData.displayName || formData.name,
            phone: formData.phone,
            email: formData.email,
          }
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Motorista cadastrado com sucesso!");
      setCreateDialogOpen(false);
      setFormData({ name: "", displayName: "", phone: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ["spokeDrivers"] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Atualizar motorista
  const updateDriverMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriver) return;
      if (!formData.name.trim()) {
        throw new Error("Digite o nome do motorista");
      }

      setIsSubmitting(true);
      
      const { error } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: `drivers/${selectedDriver.id}`,
          method: "PATCH",
          body: {
            name: formData.name,
            displayName: formData.displayName || formData.name,
            phone: formData.phone,
            email: formData.email,
          }
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Motorista atualizado com sucesso!");
      setEditDialogOpen(false);
      setSelectedDriver(null);
      setFormData({ name: "", displayName: "", phone: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ["spokeDrivers"] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Excluir motorista
  const deleteDriverMutation = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase.functions.invoke("spoke-proxy", {
        body: {
          action: `drivers/${driverId}`,
          method: "DELETE",
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Motorista excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["spokeDrivers"] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleCreate = () => {
    createDriverMutation.mutate();
  };

  const handleEdit = () => {
    updateDriverMutation.mutate();
  };

  const handleDelete = (driverId: string) => {
    if (confirm("Tem certeza que deseja excluir este motorista?")) {
      deleteDriverMutation.mutate(driverId);
    }
  };

  const openEditDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      displayName: driver.displayName || "",
      phone: driver.phone || "",
      email: driver.email || "",
    });
    setEditDialogOpen(true);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
      case 'online':
        return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Online</Badge>;
      case 'offline':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Offline</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500 gap-1"><Clock className="w-3 h-3" /> Indisponível</Badge>;
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 text-gray-800 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Gestão de Motoristas</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                <User className="w-3 h-3" /> Spoke/Circuit
            </Badge>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Motorista
            </Button>
        </div>
      </div>

      {/* Lista de Motoristas */}
      <Card className="shadow-sm border-none overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 border-b py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase">
              <User className="h-4 w-4" /> Motoristas Cadastrados
            </div>
            <Badge variant="secondary">{drivers?.length || 0}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-20 text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" />
              <p className="text-muted-foreground animate-pulse">Carregando motoristas...</p>
            </div>
          ) : drivers && drivers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver: Driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-bold">{driver.name}</span>
                        {driver.displayName && driver.displayName !== driver.name && (
                          <span className="text-xs text-muted-foreground">{driver.displayName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {driver.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {driver.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {driver.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(driver.status)}</TableCell>
                    <TableCell>
                      {new Date(driver.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(driver)}
                          className="gap-1"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(driver.id)}
                          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-24 text-center">
              <User className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium italic">Nenhum motorista cadastrado. Adicione um novo motorista para começar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Criar Motorista */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Motorista</DialogTitle>
            <DialogDescription>
              Preencha os dados do motoboy para cadastrá-lo no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                placeholder="Ex: João (opcional)"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="Ex: (41) 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Ex: joao@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={isSubmitting || !formData.name.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cadastrando...</>
              ) : (
                <><Plus className="w-4 h-4" /> Cadastrar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Motorista */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Motorista</DialogTitle>
            <DialogDescription>
              Atualize os dados do motorista.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo *</Label>
              <Input
                id="edit-name"
                placeholder="Ex: João Silva"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Nome de Exibição</Label>
              <Input
                id="edit-displayName"
                placeholder="Ex: João (opcional)"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                placeholder="Ex: (41) 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="Ex: joao@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={isSubmitting || !formData.name.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Atualizando...</>
              ) : (
                <><Edit className="w-4 h-4" /> Atualizar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriversManagementPage;
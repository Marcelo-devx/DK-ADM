"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Pencil, Bike } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface ShippingRate {
  id: number;
  location_name: string;
  price: number;
  is_active: boolean;
}

export default function ShippingRatesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  
  // Form States
  const [locationName, setLocationName] = useState("");
  const [price, setPrice] = useState("");

  const { data: rates, isLoading } = useQuery({
    queryKey: ["shippingRates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_rates")
        .select("*")
        .order("location_name");
      if (error) throw error;
      return data as ShippingRate[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        location_name: locationName,
        price: parseFloat(price.replace(',', '.')),
        is_active: true
      };

      if (editingRate) {
        const { error } = await supabase
          .from("shipping_rates")
          .update(payload)
          .eq("id", editingRate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shipping_rates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingRates"] });
      setIsModalOpen(false);
      resetForm();
      showSuccess(editingRate ? "Frete atualizado!" : "Local adicionado!");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("shipping_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingRates"] });
      showSuccess("Removido com sucesso.");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: boolean }) => {
        const { error } = await supabase.from("shipping_rates").update({ is_active: status }).eq("id", id);
        if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shippingRates"] }),
  });

  const resetForm = () => {
    setEditingRate(null);
    setLocationName("");
    setPrice("");
  };

  const handleEdit = (rate: ShippingRate) => {
    setEditingRate(rate);
    setLocationName(rate.location_name);
    setPrice(rate.price.toString());
    setIsModalOpen(true);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bike className="h-8 w-8 text-indigo-600" /> Tabela de Fretes
            </h1>
            <p className="text-muted-foreground">Defina os valores de entrega automática por Bairro ou Cidade.</p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Novo Local
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingRate ? "Editar Taxa" : "Adicionar Local de Entrega"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nome do Local (Bairro/Cidade)</Label>
                        <Input 
                            placeholder="Ex: Centro, Zona Sul, Cotia..." 
                            value={locationName} 
                            onChange={(e) => setLocationName(e.target.value)} 
                        />
                        <p className="text-[10px] text-muted-foreground">
                            O sistema tentará encontrar este nome no endereço do cliente.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>Valor da Entrega (R$)</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={price} 
                            onChange={(e) => setPrice(e.target.value)} 
                        />
                    </div>
                    <Button 
                        onClick={() => upsertMutation.mutate()} 
                        disabled={upsertMutation.isPending || !locationName || !price}
                        className="w-full font-bold"
                    >
                        {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50">
                <TableRow>
                    <TableHead>Localidade</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : rates?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum frete cadastrado.</TableCell></TableRow>
                ) : (
                    rates?.map((rate) => (
                        <TableRow key={rate.id}>
                            <TableCell className="font-medium flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {rate.location_name}
                            </TableCell>
                            <TableCell className="font-bold text-green-700">
                                {formatCurrency(rate.price)}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Switch 
                                        checked={rate.is_active} 
                                        onCheckedChange={(val) => toggleActiveMutation.mutate({ id: rate.id, status: val })} 
                                    />
                                    <Badge variant={rate.is_active ? "outline" : "secondary"}>
                                        {rate.is_active ? "Ativo" : "Inativo"}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(rate)}>
                                    <Pencil className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { if(confirm("Excluir este local?")) deleteMutation.mutate(rate.id) }}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}
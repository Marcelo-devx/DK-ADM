import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface ShippingZone {
  id: string;
  transportadora: string;
  cep_start: string;
  cep_end: string;
  price: string;
  city: string;
}

export const ShippingZones = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transportadora, setTransportadora] = useState("Transportadora RMC");
  const [cepStart, setCepStart] = useState("");
  const [cepEnd, setCepEnd] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");

  const { data: zones, isLoading } = useQuery({
    queryKey: ["shippingZones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ShippingZone[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        transportadora,
        cep_start: cepStart,
        cep_end: cepEnd,
        price: price ? parseFloat(price) : null,
        city,
      };
      const { error } = await supabase.from("shipping_zones").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingZones"] });
      setIsModalOpen(false);
      setCepStart("");
      setCepEnd("");
      setPrice("");
      setCity("");
      showSuccess("Zona adicionada com sucesso");
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingZones"] });
      showSuccess("Zona removida");
    },
    onError: (err: any) => showError(err.message),
  });

  return (
    <div className="mt-6 bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Zonas de Entrega por CEP</h2>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-2" /> Nova Zona</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Zona de CEP</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Transportadora</Label>
                <Input value={transportadora} onChange={(e) => setTransportadora(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CEP inicial</Label>
                  <Input value={cepStart} onChange={(e) => setCepStart(e.target.value)} placeholder="00000-000" />
                </div>
                <div>
                  <Label>CEP final</Label>
                  <Input value={cepEnd} onChange={(e) => setCepEnd(e.target.value)} placeholder="00000-000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Cidade / Região</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Curitiba e Região" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {createMutation.isPending ? "Salvando..." : "Salvar Zona"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transportadora</TableHead>
            <TableHead>CEP Inicial</TableHead>
            <TableHead>CEP Final</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Cidade / Região</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
          ) : (zones?.length || 0) === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center">Nenhuma zona cadastrada.</TableCell></TableRow>
          ) : (
            zones?.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.transportadora}</TableCell>
                <TableCell>{z.cep_start}</TableCell>
                <TableCell>{z.cep_end}</TableCell>
                <TableCell className="font-medium">{z.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(String(z.price))) : '-'}</TableCell>
                <TableCell>{z.city}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Excluir esta zona?')) deleteMutation.mutate(z.id) }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

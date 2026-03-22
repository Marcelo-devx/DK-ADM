import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface ShippingZone {
  id: string;
  transportadora: string;
  cep_start: string;
  cep_end: string;
  price: string;
  city: string;
}

const normalizeCep = (cep: string) => cep.replace(/\D/g, '');
const cepToNumber = (cep: string) => {
  const n = normalizeCep(cep);
  return n ? parseInt(n, 10) : NaN;
}

const isCepFormatValid = (cep: string) => /^\d{5}-\d{3}$/.test(cep.trim());

export const ShippingZones = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transportadora, setTransportadora] = useState("Transportadora RMC");
  const [cepStart, setCepStart] = useState("");
  const [cepEnd, setCepEnd] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [selectedZone, setSelectedZone] = useState<ShippingZone | null>(null);

  const { data: zones, isLoading } = useQuery({
    queryKey: ["shippingZones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ShippingZone[];
    },
  });

  const [overlapZones, setOverlapZones] = useState<ShippingZone[]>([]);
  const [cepFormatWarning, setCepFormatWarning] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedZone(null);
    setTransportadora("Transportadora RMC");
    setCepStart("");
    setCepEnd("");
    setPrice("");
    setCity("");
    setOverlapZones([]);
    setCepFormatWarning(null);
  };

  useEffect(() => {
    if (!isModalOpen) resetForm();
  }, [isModalOpen]);

  // Compute warnings when CEPs or zones change
  useEffect(() => {
    // reset
    setOverlapZones([]);
    setCepFormatWarning(null);

    if (!cepStart && !cepEnd) return;

    // Validate format
    if (cepStart && !isCepFormatValid(cepStart)) {
      setCepFormatWarning('Formato do CEP inicial inválido. Use 00000-000');
    }
    if (cepEnd && !isCepFormatValid(cepEnd)) {
      setCepFormatWarning(prev => prev ? prev + ' / Formato do CEP final inválido. Use 00000-000' : 'Formato do CEP final inválido. Use 00000-000');
    }

    const sNum = cepToNumber(cepStart);
    const eNum = cepToNumber(cepEnd);

    if (Number.isNaN(sNum) || Number.isNaN(eNum)) return;
    if (sNum > eNum) {
      // swap? just warn
      setCepFormatWarning(prev => (prev ? prev + ' / CEP inicial é maior que o CEP final.' : 'CEP inicial é maior que o CEP final.'));
    }

    // find overlaps for same transportadora
    if (zones && zones.length > 0) {
      const overlaps = zones.filter(z => {
        // if editing an existing zone, skip comparing to itself
        if (selectedZone && z.id === selectedZone.id) return false;
        if (z.transportadora !== transportadora) return false;
        const zs = cepToNumber(z.cep_start);
        const ze = cepToNumber(z.cep_end);
        if (Number.isNaN(zs) || Number.isNaN(ze)) return false;
        // overlap if ranges intersect
        return !(eNum < zs || sNum > ze);
      });
      if (overlaps.length > 0) setOverlapZones(overlaps);
    }
  }, [cepStart, cepEnd, zones, transportadora, selectedZone]);

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
      resetForm();
      showSuccess("Zona adicionada com sucesso");
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedZone) return;
      const payload = {
        transportadora,
        cep_start: cepStart,
        cep_end: cepEnd,
        price: price ? parseFloat(price) : null,
        city,
      };
      const { error } = await supabase.from("shipping_zones").update(payload).eq("id", selectedZone.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingZones"] });
      setIsModalOpen(false);
      resetForm();
      showSuccess("Zona atualizada com sucesso");
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

  const openEditModal = (zone: ShippingZone) => {
    setSelectedZone(zone);
    setTransportadora(zone.transportadora || "Transportadora RMC");
    setCepStart(zone.cep_start || "");
    setCepEnd(zone.cep_end || "");
    setPrice(zone.price ? String(zone.price) : "");
    setCity(zone.city || "");
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (selectedZone) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

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
              <DialogTitle>{selectedZone ? 'Editar Zona de CEP' : 'Adicionar Zona de CEP'}</DialogTitle>
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

              {/* Warnings */}
              {cepFormatWarning && (
                <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                  <strong>Atenção:</strong> {cepFormatWarning}
                </div>
              )}

              {overlapZones.length > 0 && (
                <div className="text-sm text-orange-800 bg-orange-50 border border-orange-200 p-2 rounded">
                  <strong>Aviso:</strong> A faixa de CEP informada sobrepõe-se com as zonas abaixo para a mesma transportadora. Isso não removerá ou alterará nada automaticamente — apenas um aviso.
                  <ul className="mt-2 list-disc pl-5">
                    {overlapZones.map(o => (
                      <li key={o.id}>{o.transportadora}: {o.cep_start} → {o.cep_end} ({o.city || '-'})</li>
                    ))}
                  </ul>
                </div>
              )}

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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : (selectedZone ? "Salvar Alterações" : "Salvar Zona")}
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
                <TableCell className="font-medium cursor-pointer text-indigo-700" onClick={() => openEditModal(z)}>{z.transportadora}</TableCell>
                <TableCell>{z.cep_start}</TableCell>
                <TableCell>{z.cep_end}</TableCell>
                <TableCell className="font-medium">{z.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(String(z.price))) : '-'}</TableCell>
                <TableCell>{z.city}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(z)}>
                      <Pencil className="w-4 h-4 text-blue-600" />
                    </Button>
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
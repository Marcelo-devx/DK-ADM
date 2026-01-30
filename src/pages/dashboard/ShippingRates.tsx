"use client";

import { useState, useMemo, useEffect } from "react";
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
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Pencil, Bike, Building2, Search, Settings, Truck } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShippingRate {
  id: number;
  neighborhood: string;
  city: string;
  price: number;
  is_active: boolean;
}

export default function ShippingRatesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSedexModalOpen, setIsSedexModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  
  // Form States (Tabela)
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Curitiba");
  const [price, setPrice] = useState("");

  // Form State (Sedex)
  const [sedexPrice, setSedexPrice] = useState("");

  // Busca Taxas Individuais
  const { data: rates, isLoading } = useQuery({
    queryKey: ["shippingRates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_rates")
        .select("*")
        .order("city")
        .order("neighborhood");
      if (error) throw error;
      return data as ShippingRate[];
    },
  });

  // Busca Valor do Sedex (Configuração Global)
  const { data: sedexSetting, isLoading: isLoadingSedex } = useQuery({
    queryKey: ["sedexPriceSetting"],
    queryFn: async () => {
        const { data } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "default_sedex_price")
            .single();
        return data?.value || "0";
    }
  });

  useEffect(() => {
    if (sedexSetting) {
        setSedexPrice(sedexSetting);
    }
  }, [sedexSetting]);

  const uniqueCities = useMemo(() => {
    if (!rates) return [];
    return Array.from(new Set(rates.map(r => r.city))).sort();
  }, [rates]);

  const filteredRates = useMemo(() => {
    if (!rates) return [];
    return rates.filter(rate => {
      const matchesSearch = 
        rate.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rate.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCity = cityFilter === "all" || rate.city === cityFilter;

      return matchesSearch && matchesCity;
    });
  }, [rates, searchTerm, cityFilter]);

  // Mutation para salvar configuração do Sedex
  const saveSedexMutation = useMutation({
    mutationFn: async (value: string) => {
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key: "default_sedex_price", value: value }, { onConflict: "key" });
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["sedexPriceSetting"] });
        setIsSedexModalOpen(false);
        showSuccess("Valor do Sedex padrão atualizado!");
    },
    onError: (err: any) => showError(err.message),
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        neighborhood: neighborhood,
        city: city,
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
    setNeighborhood("");
    setCity("Curitiba");
    setPrice("");
  };

  const handleEdit = (rate: ShippingRate) => {
    setEditingRate(rate);
    setNeighborhood(rate.neighborhood);
    setCity(rate.city || "Curitiba");
    setPrice(rate.price.toString());
    setIsModalOpen(true);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bike className="h-8 w-8 text-indigo-600" /> Tabela de Fretes
            </h1>
            <p className="text-muted-foreground">Defina os valores de entrega por bairro e cidade.</p>
        </div>
        
        <div className="flex gap-2">
            {/* BOTÃO CONFIGURAR SEDEX */}
            <Dialog open={isSedexModalOpen} onOpenChange={setIsSedexModalOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold">
                        <Truck className="w-4 h-4 mr-2" /> 
                        Sedex: {isLoadingSedex ? "..." : formatCurrency(parseFloat(sedexSetting || "0"))}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Frete Padrão (Sedex)</DialogTitle>
                        <DialogDescription>
                            Este valor será cobrado quando o endereço do cliente <strong>não for encontrado</strong> na tabela de bairros.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Valor Fixo do Sedex (R$)</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                value={sedexPrice} 
                                onChange={(e) => setSedexPrice(e.target.value)} 
                            />
                        </div>
                        <Button 
                            onClick={() => saveSedexMutation.mutate(sedexPrice)} 
                            disabled={saveSedexMutation.isPending}
                            className="w-full font-bold bg-indigo-600 hover:bg-indigo-700"
                        >
                            {saveSedexMutation.isPending ? "Salvando..." : "Salvar Valor Padrão"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* BOTÃO NOVO LOCAL */}
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
                            <Label>Cidade</Label>
                            <Input 
                                placeholder="Ex: Curitiba" 
                                value={city} 
                                onChange={(e) => setCity(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bairro</Label>
                            <Input 
                                placeholder="Ex: Batel, Centro..." 
                                value={neighborhood} 
                                onChange={(e) => setNeighborhood(e.target.value)} 
                            />
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
                            disabled={upsertMutation.isPending || !neighborhood || !city || !price}
                            className="w-full font-bold"
                        >
                            {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Buscar por bairro..." 
                className="pl-9 bg-gray-50/50" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
            />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="bg-gray-50/50">
                <SelectValue placeholder="Filtrar por Cidade" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as Cidades</SelectItem>
                {uniqueCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50">
                <TableRow>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filteredRates?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum local encontrado com os filtros atuais.</TableCell></TableRow>
                ) : (
                    filteredRates?.map((rate) => (
                        <TableRow key={rate.id}>
                            <TableCell className="font-bold flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {rate.neighborhood}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                    <Building2 className="w-3 h-3" /> {rate.city}
                                </div>
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
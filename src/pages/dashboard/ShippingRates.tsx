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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Plus,
  Trash2,
  Pencil,
  Bike,
  Building2,
  Search,
  Truck,
  Filter,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShippingZones } from "@/components/dashboard/ShippingZones";
import { cn } from "@/lib/utils";

interface ShippingRate {
  id: number;
  neighborhood: string;
  city: string;
  price: number;
  is_active: boolean;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

// ─── Cidades pré-definidas ────────────────────────────────────────────────────
const PRESET_CITIES = [
  "Curitiba",
  "São José dos Pinhais",
  "Araucária",
  "Campo Largo",
  "Colombo",
  "Pinhais",
  "Fazenda Rio Grande",
  "Almirante Tamandaré",
  "Piraquara",
  "Quatro Barras",
  "Campina Grande do Sul",
  "Mandirituba",
  "Contenda",
  "Balsa Nova",
  "Lapa",
  "Outra",
];

export default function ShippingRatesPage() {
  const queryClient = useQueryClient();

  // ── Modais ──────────────────────────────────────────────────────────────────
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);
  const [isSedexModalOpen, setIsSedexModalOpen] = useState(false);
  const [isTransportadoraRmcModalOpen, setIsTransportadoraRmcModalOpen] = useState(false);
  const [isTransportadoraParanaModalOpen, setIsTransportadoraParanaModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Form: Novo Local ────────────────────────────────────────────────────────
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Curitiba");
  const [customCity, setCustomCity] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ── Form: Sedex / Transportadoras ───────────────────────────────────────────
  const [sedexPrice, setSedexPrice] = useState("");
  const [transportadoraRmcPrice, setTransportadoraRmcPrice] = useState("");
  const [transportadoraParanaPrice, setTransportadoraParanaPrice] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────
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

  const { data: sedexSetting, isLoading: isLoadingSedex } = useQuery({
    queryKey: ["sedexPriceSetting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_sedex_price")
        .single();
      return data?.value || "0";
    },
  });

  const { data: transportadoraRmcSetting, isLoading: isLoadingRmc } = useQuery({
    queryKey: ["transportadoraRmcSetting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "shipping_transportadora_rmc")
        .single();
      return data?.value || "0";
    },
  });

  const { data: transportadoraParanaSetting, isLoading: isLoadingParana } = useQuery({
    queryKey: ["transportadoraParanaSetting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "shipping_transportadora_parana")
        .single();
      return data?.value || "0";
    },
  });

  useEffect(() => { if (sedexSetting) setSedexPrice(sedexSetting); }, [sedexSetting]);
  useEffect(() => { if (transportadoraRmcSetting) setTransportadoraRmcPrice(transportadoraRmcSetting); }, [transportadoraRmcSetting]);
  useEffect(() => { if (transportadoraParanaSetting) setTransportadoraParanaPrice(transportadoraParanaSetting); }, [transportadoraParanaSetting]);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const uniqueCities = useMemo(() => {
    if (!rates) return [];
    return Array.from(new Set(rates.map((r) => r.city))).sort();
  }, [rates]);

  const stats = useMemo(() => {
    if (!rates) return { total: 0, active: 0, inactive: 0, avgPrice: 0 };
    const active = rates.filter((r) => r.is_active).length;
    const avgPrice = rates.length > 0 ? rates.reduce((s, r) => s + r.price, 0) / rates.length : 0;
    return { total: rates.length, active, inactive: rates.length - active, avgPrice };
  }, [rates]);

  const filteredRates = useMemo(() => {
    if (!rates) return [];
    return rates.filter((rate) => {
      const matchesSearch =
        rate.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rate.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCity = cityFilter === "all" || rate.city === cityFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && rate.is_active) ||
        (statusFilter === "inactive" && !rate.is_active);
      const matchesPriceMin = priceMin === "" || rate.price >= parseFloat(priceMin);
      const matchesPriceMax = priceMax === "" || rate.price <= parseFloat(priceMax);
      return matchesSearch && matchesCity && matchesStatus && matchesPriceMin && matchesPriceMax;
    });
  }, [rates, searchTerm, cityFilter, statusFilter, priceMin, priceMax]);

  const activeFiltersCount = [
    cityFilter !== "all",
    statusFilter !== "all",
    priceMin !== "",
    priceMax !== "",
  ].filter(Boolean).length;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveSedexMutation = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "default_sedex_price", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sedexPriceSetting"] });
      setIsSedexModalOpen(false);
      showSuccess("Valor do Sedex atualizado!");
    },
    onError: (err: any) => showError(err.message),
  });

  const saveTransportadoraRmcMutation = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "shipping_transportadora_rmc", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportadoraRmcSetting"] });
      setIsTransportadoraRmcModalOpen(false);
      showSuccess("Transportadora RMC atualizada!");
    },
    onError: (err: any) => showError(err.message),
  });

  const saveTransportadoraParanaMutation = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "shipping_transportadora_parana", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportadoraParanaSetting"] });
      setIsTransportadoraParanaModalOpen(false);
      showSuccess("Transportadora Paraná atualizada!");
    },
    onError: (err: any) => showError(err.message),
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const finalCity = city === "Outra" ? customCity.trim() : city;
      const payload = {
        neighborhood: neighborhood.trim(),
        city: finalCity,
        price: parseFloat(price.replace(",", ".")),
        is_active: isActive,
      };
      if (editingRate) {
        const { error } = await supabase
          .from("shipping_rates")
          .update(payload)
          .eq("id", editingRate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shipping_rates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingRates"] });
      setIsLocalModalOpen(false);
      resetForm();
      showSuccess(editingRate ? "Frete atualizado!" : "Local adicionado com sucesso!");
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
    mutationFn: async ({ id, status }: { id: number; status: boolean }) => {
      const { error } = await supabase
        .from("shipping_rates")
        .update({ is_active: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shippingRates"] }),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingRate(null);
    setNeighborhood("");
    setCity("Curitiba");
    setCustomCity("");
    setPrice("");
    setIsActive(true);
  };

  const handleEdit = (rate: ShippingRate) => {
    setEditingRate(rate);
    setNeighborhood(rate.neighborhood);
    const isPreset = PRESET_CITIES.includes(rate.city);
    setCity(isPreset ? rate.city : "Outra");
    setCustomCity(isPreset ? "" : rate.city);
    setPrice(rate.price.toString());
    setIsActive(rate.is_active);
    setIsLocalModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCityFilter("all");
    setStatusFilter("all");
    setPriceMin("");
    setPriceMax("");
  };

  const isFormValid =
    neighborhood.trim() !== "" &&
    (city !== "Outra" || customCity.trim() !== "") &&
    price !== "" &&
    !isNaN(parseFloat(price.replace(",", ".")));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bike className="h-8 w-8 text-indigo-600" /> Tabela de Fretes
          </h1>
          <p className="text-muted-foreground">
            Gerencie os valores de entrega por bairro, cidade e transportadora.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Sedex */}
          {!isLoadingSedex && parseFloat(sedexSetting || "0") > 0 && (
            <Dialog open={isSedexModalOpen} onOpenChange={setIsSedexModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold">
                  <Truck className="w-4 h-4 mr-2" />
                  Sedex: {formatCurrency(parseFloat(sedexSetting || "0"))}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Frete Padrão (Sedex)</DialogTitle>
                  <DialogDescription>
                    Cobrado quando o endereço <strong>não é encontrado</strong> na tabela de bairros.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Valor Fixo do Sedex (R$)</Label>
                    <Input type="number" step="0.01" placeholder="0.00" value={sedexPrice} onChange={(e) => setSedexPrice(e.target.value)} />
                  </div>
                  <Button onClick={() => saveSedexMutation.mutate(sedexPrice)} disabled={saveSedexMutation.isPending} className="w-full font-bold bg-indigo-600 hover:bg-indigo-700">
                    {saveSedexMutation.isPending ? "Salvando..." : "Salvar Valor"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Transportadora RMC */}
          <Dialog open={isTransportadoraRmcModalOpen} onOpenChange={setIsTransportadoraRmcModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
                <Building2 className="w-4 h-4 mr-2" />
                RMC: {isLoadingRmc ? "..." : formatCurrency(parseFloat(transportadoraRmcSetting || "0"))}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transportadora RMC</DialogTitle>
                <DialogDescription>Valor fixo para entrega via Transportadora RMC.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={transportadoraRmcPrice} onChange={(e) => setTransportadoraRmcPrice(e.target.value)} />
                </div>
                <Button onClick={() => saveTransportadoraRmcMutation.mutate(transportadoraRmcPrice)} disabled={saveTransportadoraRmcMutation.isPending} className="w-full font-bold bg-blue-600 hover:bg-blue-700">
                  {saveTransportadoraRmcMutation.isPending ? "Salvando..." : "Salvar Valor"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Transportadora Paraná */}
          <Dialog open={isTransportadoraParanaModalOpen} onOpenChange={setIsTransportadoraParanaModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 font-bold">
                <Building2 className="w-4 h-4 mr-2" />
                Paraná: {isLoadingParana ? "..." : formatCurrency(parseFloat(transportadoraParanaSetting || "0"))}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transportadora Paraná</DialogTitle>
                <DialogDescription>Valor fixo para entrega via Transportadora Paraná.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={transportadoraParanaPrice} onChange={(e) => setTransportadoraParanaPrice(e.target.value)} />
                </div>
                <Button onClick={() => saveTransportadoraParanaMutation.mutate(transportadoraParanaPrice)} disabled={saveTransportadoraParanaMutation.isPending} className="w-full font-bold bg-green-600 hover:bg-green-700">
                  {saveTransportadoraParanaMutation.isPending ? "Salvando..." : "Salvar Valor"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Novo Local */}
          <Dialog open={isLocalModalOpen} onOpenChange={(open) => { setIsLocalModalOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> Novo Local
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  {editingRate ? "Editar Local de Entrega" : "Adicionar Local de Entrega"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do bairro e o valor da taxa de entrega.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Cidade */}
                <div className="space-y-2">
                  <Label className="font-semibold">
                    Cidade <span className="text-red-500">*</span>
                  </Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className="bg-gray-50">
                      <SelectValue placeholder="Selecione a cidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_CITIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {city === "Outra" && (
                    <Input
                      placeholder="Digite o nome da cidade"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      className="bg-gray-50 mt-2"
                      autoFocus
                    />
                  )}
                </div>

                {/* Bairro */}
                <div className="space-y-2">
                  <Label className="font-semibold">
                    Bairro <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Ex: Batel, Centro, Água Verde..."
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="pl-9 bg-gray-50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o nome exato do bairro como aparece no endereço do cliente.
                  </p>
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label className="font-semibold">
                    Valor da Entrega (R$) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="pl-9 bg-gray-50 font-medium"
                    />
                  </div>
                  {price && !isNaN(parseFloat(price)) && (
                    <p className="text-xs text-indigo-600 font-medium">
                      = {formatCurrency(parseFloat(price.replace(",", ".")))}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-semibold text-sm">Status do local</p>
                    <p className="text-xs text-muted-foreground">
                      {isActive ? "Ativo — disponível para entrega" : "Inativo — não aparece no checkout"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <Badge variant={isActive ? "outline" : "secondary"} className={isActive ? "text-green-700 border-green-300" : ""}>
                      {isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>

                {/* Preview */}
                {neighborhood && city && price && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                    <p className="text-indigo-700 font-semibold mb-1">📦 Resumo</p>
                    <p className="text-indigo-800">
                      <strong>{neighborhood}</strong> — {city === "Outra" ? customCity || "..." : city}
                    </p>
                    <p className="text-indigo-900 font-bold text-base mt-1">
                      {!isNaN(parseFloat(price.replace(",", "."))) ? formatCurrency(parseFloat(price.replace(",", "."))) : "—"}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setIsLocalModalOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => upsertMutation.mutate()}
                    disabled={upsertMutation.isPending || !isFormValid}
                    className="flex-1 font-bold bg-indigo-600 hover:bg-indigo-700"
                  >
                    {upsertMutation.isPending ? "Salvando..." : editingRate ? "Salvar Alterações" : "Adicionar Local"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Cards de Resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Locais", value: stats.total, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" },
          { label: "Ativos", value: stats.active, color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
          { label: "Inativos", value: stats.inactive, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
          { label: "Ticket Médio", value: formatCurrency(stats.avgPrice), color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
        ].map((card) => (
          <div key={card.label} className={cn("rounded-xl border p-4", card.bg, card.border)}>
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <p className={cn("text-2xl font-bold mt-1", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        {/* Linha principal de busca */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por bairro ou cidade..."
              className="pl-9 bg-gray-50/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-2 font-medium", activeFiltersCount > 0 && "border-indigo-400 text-indigo-700 bg-indigo-50")}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
              <X className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>

        {/* Filtros avançados */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t">
            {/* Cidade */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cidade</Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="bg-gray-50/50 h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {uniqueCities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-gray-50/50 h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">✅ Ativos</SelectItem>
                  <SelectItem value="inactive">❌ Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor mínimo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor mínimo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="bg-gray-50/50 h-9"
              />
            </div>

            {/* Valor máximo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor máximo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="999,00"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="bg-gray-50/50 h-9"
              />
            </div>
          </div>
        )}

        {/* Resultado dos filtros */}
        {(searchTerm || activeFiltersCount > 0) && (
          <p className="text-xs text-muted-foreground">
            Exibindo <strong>{filteredRates.length}</strong> de <strong>{rates?.length || 0}</strong> locais
          </p>
        )}
      </div>

      {/* ── Mobile: cards ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-24" />
          ))
        ) : filteredRates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground bg-white rounded-xl border">
            <MapPin className="w-8 h-8 opacity-30" />
            <p className="font-medium">Nenhum local encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou adicione um novo local.</p>
          </div>
        ) : (
          filteredRates.map((rate) => (
            <div
              key={rate.id}
              className={cn(
                "bg-white rounded-xl border-2 shadow-sm p-4 space-y-3",
                rate.is_active ? "border-gray-100" : "border-gray-100 opacity-60"
              )}
            >
              {/* Bairro + ações */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-bold text-gray-800 truncate">{rate.neighborhood}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => handleEdit(rate)}>
                    <Pencil className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => { if (confirm("Excluir este local de entrega?")) deleteMutation.mutate(rate.id); }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {/* Cidade + valor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  {rate.city}
                </div>
                <span className="font-bold text-green-700 text-lg">
                  {formatCurrency(rate.price)}
                </span>
              </div>

              {/* Status switch */}
              <div className={cn(
                "flex items-center justify-between p-2.5 rounded-lg border",
                rate.is_active ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
              )}>
                <span className={cn("text-xs font-bold", rate.is_active ? "text-green-700" : "text-gray-500")}>
                  {rate.is_active ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Ativo</span> : <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Inativo</span>}
                </span>
                <Switch
                  checked={rate.is_active}
                  onCheckedChange={(val) => toggleActiveMutation.mutate({ id: rate.id, status: val })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-bold">Bairro</TableHead>
              <TableHead className="font-bold">Cidade</TableHead>
              <TableHead className="font-bold">Valor</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MapPin className="w-8 h-8 opacity-30" />
                    <p className="font-medium">Nenhum local encontrado</p>
                    <p className="text-sm">Tente ajustar os filtros ou adicione um novo local.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRates.map((rate) => (
                <TableRow key={rate.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-semibold text-gray-800">{rate.neighborhood}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5" />
                      {rate.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-green-700 text-base">{formatCurrency(rate.price)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rate.is_active}
                        onCheckedChange={(val) => toggleActiveMutation.mutate({ id: rate.id, status: val })}
                      />
                      <Badge
                        variant={rate.is_active ? "outline" : "secondary"}
                        className={cn("text-xs font-semibold", rate.is_active ? "text-green-700 border-green-300 bg-green-50" : "text-gray-500")}
                      >
                        {rate.is_active ? <><CheckCircle2 className="w-3 h-3 mr-1" />Ativo</> : <><XCircle className="w-3 h-3 mr-1" />Inativo</>}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rate)} className="hover:bg-blue-50" title="Editar">
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este local de entrega?")) deleteMutation.mutate(rate.id); }} className="hover:bg-red-50" title="Excluir">
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

      {/* ── Zonas por Transportadora (faixas de CEP) ── */}
      <ShippingZones />
    </div>
  );
}

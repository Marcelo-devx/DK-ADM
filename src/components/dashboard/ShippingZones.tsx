import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Trash2,
  Plus,
  Pencil,
  Truck,
  AlertTriangle,
  Info,
  MapPin,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ShippingZone {
  id: string;
  transportadora: string;
  cep_start: string;
  cep_end: string;
  price: string;
  city: string;
}

const normalizeCep = (cep: string) => cep.replace(/\D/g, "");
const cepToNumber = (cep: string) => {
  const n = normalizeCep(cep);
  return n ? parseInt(n, 10) : NaN;
};
const isCepFormatValid = (cep: string) => /^\d{5}-\d{3}$/.test(cep.trim());

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const PRESET_TRANSPORTADORAS = [
  "Transportadora RMC",
  "Transportadora Paraná",
  "Correios",
  "Jadlog",
  "Total Express",
  "Outra",
];

export const ShippingZones = () => {
  const queryClient = useQueryClient();

  // ── Modais ──────────────────────────────────────────────────────────────────
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ShippingZone | null>(null);

  // ── Agrupamento ─────────────────────────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Form ────────────────────────────────────────────────────────────────────
  const [transportadora, setTransportadora] = useState("Transportadora RMC");
  const [customTransportadora, setCustomTransportadora] = useState("");
  const [cepStart, setCepStart] = useState("");
  const [cepEnd, setCepEnd] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");

  // ── Validações ──────────────────────────────────────────────────────────────
  const [overlapZones, setOverlapZones] = useState<ShippingZone[]>([]);
  const [cepWarning, setCepWarning] = useState<string | null>(null);

  // ── Query ───────────────────────────────────────────────────────────────────
  const { data: zones, isLoading } = useQuery({
    queryKey: ["shippingZones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .order("transportadora")
        .order("cep_start");
      if (error) throw error;
      return data as ShippingZone[];
    },
  });

  // Agrupar por transportadora
  const groupedZones = (zones || []).reduce<Record<string, ShippingZone[]>>((acc, z) => {
    if (!acc[z.transportadora]) acc[z.transportadora] = [];
    acc[z.transportadora].push(z);
    return acc;
  }, {});

  const transportadoraNames = Object.keys(groupedZones).sort();

  // ── Validação de CEP em tempo real ──────────────────────────────────────────
  useEffect(() => {
    setCepWarning(null);
    setOverlapZones([]);

    if (!cepStart && !cepEnd) return;

    const warnings: string[] = [];

    if (cepStart && !isCepFormatValid(cepStart)) warnings.push("CEP inicial inválido (use 00000-000)");
    if (cepEnd && !isCepFormatValid(cepEnd)) warnings.push("CEP final inválido (use 00000-000)");

    const sNum = cepToNumber(cepStart);
    const eNum = cepToNumber(cepEnd);

    if (!Number.isNaN(sNum) && !Number.isNaN(eNum) && sNum > eNum) {
      warnings.push("CEP inicial é maior que o CEP final");
    }

    if (warnings.length > 0) {
      setCepWarning(warnings.join(" · "));
      return;
    }

    if (zones && !Number.isNaN(sNum) && !Number.isNaN(eNum)) {
      const finalTransportadora = transportadora === "Outra" ? customTransportadora : transportadora;
      const overlaps = zones.filter((z) => {
        if (selectedZone && z.id === selectedZone.id) return false;
        if (z.transportadora !== finalTransportadora) return false;
        const zs = cepToNumber(z.cep_start);
        const ze = cepToNumber(z.cep_end);
        if (Number.isNaN(zs) || Number.isNaN(ze)) return false;
        return !(eNum < zs || sNum > ze);
      });
      setOverlapZones(overlaps);
    }
  }, [cepStart, cepEnd, zones, transportadora, customTransportadora, selectedZone]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedZone(null);
    setTransportadora("Transportadora RMC");
    setCustomTransportadora("");
    setCepStart("");
    setCepEnd("");
    setPrice("");
    setCity("");
    setCepWarning(null);
    setOverlapZones([]);
  };

  const openNewModal = (presetTransportadora?: string) => {
    resetForm();
    if (presetTransportadora) {
      const isPreset = PRESET_TRANSPORTADORAS.includes(presetTransportadora);
      setTransportadora(isPreset ? presetTransportadora : "Outra");
      setCustomTransportadora(isPreset ? "" : presetTransportadora);
    }
    setIsZoneModalOpen(true);
  };

  const openEditModal = (zone: ShippingZone) => {
    setSelectedZone(zone);
    const isPreset = PRESET_TRANSPORTADORAS.includes(zone.transportadora);
    setTransportadora(isPreset ? zone.transportadora : "Outra");
    setCustomTransportadora(isPreset ? "" : zone.transportadora);
    setCepStart(zone.cep_start || "");
    setCepEnd(zone.cep_end || "");
    setPrice(zone.price ? String(zone.price) : "");
    setCity(zone.city || "");
    setIsZoneModalOpen(true);
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const isFormValid = () => {
    const finalTransportadora = transportadora === "Outra" ? customTransportadora.trim() : transportadora;
    return (
      finalTransportadora !== "" &&
      isCepFormatValid(cepStart) &&
      isCepFormatValid(cepEnd) &&
      !cepWarning &&
      price !== "" &&
      !isNaN(parseFloat(price))
    );
  };

  // ── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const finalTransportadora = transportadora === "Outra" ? customTransportadora.trim() : transportadora;
      const payload = {
        transportadora: finalTransportadora,
        cep_start: cepStart,
        cep_end: cepEnd,
        price: price ? parseFloat(price) : null,
        city: city.trim(),
      };
      const { error } = await supabase.from("shipping_zones").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingZones"] });
      setIsZoneModalOpen(false);
      resetForm();
      showSuccess("Faixa de CEP adicionada com sucesso!");
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedZone) return;
      const finalTransportadora = transportadora === "Outra" ? customTransportadora.trim() : transportadora;
      const payload = {
        transportadora: finalTransportadora,
        cep_start: cepStart,
        cep_end: cepEnd,
        price: price ? parseFloat(price) : null,
        city: city.trim(),
      };
      const { error } = await supabase.from("shipping_zones").update(payload).eq("id", selectedZone.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shippingZones"] });
      setIsZoneModalOpen(false);
      resetForm();
      showSuccess("Faixa atualizada com sucesso!");
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
      showSuccess("Faixa removida.");
    },
    onError: (err: any) => showError(err.message),
  });

  const handleSave = () => {
    if (selectedZone) updateMutation.mutate();
    else createMutation.mutate();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Faixas de CEP por Transportadora</h2>
            <p className="text-xs text-muted-foreground">
              Defina faixas de CEP e valores para cada transportadora
            </p>
          </div>
        </div>
        <Button
          onClick={() => openNewModal()}
          className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Faixa
        </Button>
      </div>

      {/* Conteúdo */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Carregando faixas...
          </div>
        ) : transportadoraNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <Truck className="w-10 h-10 opacity-20" />
            <p className="font-medium">Nenhuma transportadora cadastrada</p>
            <p className="text-sm">Clique em "Nova Faixa" para começar.</p>
          </div>
        ) : (
          transportadoraNames.map((name) => {
            const groupZones = groupedZones[name];
            const isExpanded = expandedGroups.has(name);
            const totalZones = groupZones.length;
            const avgPrice =
              groupZones.reduce((s, z) => s + (z.price ? parseFloat(String(z.price)) : 0), 0) /
              totalZones;

            return (
              <div key={name} className="border rounded-xl overflow-hidden">
                {/* Header do grupo */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroup(name)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <Truck className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-gray-800">{name}</span>
                    <Badge variant="outline" className="text-xs">
                      {totalZones} {totalZones === 1 ? "faixa" : "faixas"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground hidden md:block">
                      Ticket médio: <strong className="text-green-700">{formatCurrency(avgPrice)}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); openNewModal(name); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adicionar faixa
                    </Button>
                  </div>
                </div>

                {/* Tabela de faixas */}
                {isExpanded && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-indigo-50/50">
                        <TableHead className="text-xs font-bold text-indigo-700">CEP Inicial</TableHead>
                        <TableHead className="text-xs font-bold text-indigo-700">CEP Final</TableHead>
                        <TableHead className="text-xs font-bold text-indigo-700">Cidade / Região</TableHead>
                        <TableHead className="text-xs font-bold text-indigo-700">Valor</TableHead>
                        <TableHead className="text-right text-xs font-bold text-indigo-700">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupZones.map((z) => (
                        <TableRow key={z.id} className="hover:bg-gray-50/50">
                          <TableCell className="font-mono text-sm font-semibold">{z.cep_start}</TableCell>
                          <TableCell className="font-mono text-sm font-semibold">{z.cep_end}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5" />
                              {z.city || <span className="italic opacity-50">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-700">
                              {z.price
                                ? formatCurrency(parseFloat(String(z.price)))
                                : <span className="text-muted-foreground italic text-sm">—</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(z)}
                                className="hover:bg-blue-50 h-8 w-8"
                                title="Editar faixa"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { if (confirm("Excluir esta faixa de CEP?")) deleteMutation.mutate(z.id); }}
                                className="hover:bg-red-50 h-8 w-8"
                                title="Excluir faixa"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal de Cadastro / Edição de Faixa ── */}
      <Dialog open={isZoneModalOpen} onOpenChange={(open) => { setIsZoneModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              {selectedZone ? "Editar Faixa de CEP" : "Nova Faixa de CEP"}
            </DialogTitle>
            <DialogDescription>
              Defina a transportadora, a faixa de CEP atendida e o valor cobrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Transportadora */}
            <div className="space-y-2">
              <Label className="font-semibold">
                Transportadora <span className="text-red-500">*</span>
              </Label>
              <Select value={transportadora} onValueChange={setTransportadora}>
                <SelectTrigger className="bg-gray-50">
                  <SelectValue placeholder="Selecione a transportadora" />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TRANSPORTADORAS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transportadora === "Outra" && (
                <Input
                  placeholder="Nome da transportadora"
                  value={customTransportadora}
                  onChange={(e) => setCustomTransportadora(e.target.value)}
                  className="bg-gray-50 mt-2"
                  autoFocus
                />
              )}
            </div>

            {/* Faixa de CEP */}
            <div className="space-y-2">
              <Label className="font-semibold">
                Faixa de CEP <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CEP Inicial</Label>
                  <Input
                    value={cepStart}
                    onChange={(e) => setCepStart(formatCep(e.target.value))}
                    placeholder="00000-000"
                    className={cn(
                      "bg-gray-50 font-mono",
                      cepStart && !isCepFormatValid(cepStart) && "border-red-400 focus-visible:ring-red-400"
                    )}
                    maxLength={9}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CEP Final</Label>
                  <Input
                    value={cepEnd}
                    onChange={(e) => setCepEnd(formatCep(e.target.value))}
                    placeholder="00000-000"
                    className={cn(
                      "bg-gray-50 font-mono",
                      cepEnd && !isCepFormatValid(cepEnd) && "border-red-400 focus-visible:ring-red-400"
                    )}
                    maxLength={9}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Todos os CEPs dentro desta faixa receberão o valor definido abaixo.
              </p>
            </div>

            {/* Aviso de formato / sobreposição */}
            {cepWarning && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cepWarning}</span>
              </div>
            )}

            {overlapZones.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Sobreposição detectada
                </div>
                <p className="text-xs mb-2">Esta faixa se sobrepõe com as seguintes faixas da mesma transportadora:</p>
                <ul className="space-y-1">
                  {overlapZones.map((o) => (
                    <li key={o.id} className="text-xs bg-amber-100 rounded px-2 py-1 font-mono">
                      {o.cep_start} → {o.cep_end}
                      {o.city ? ` (${o.city})` : ""}
                      {o.price ? ` — ${formatCurrency(parseFloat(String(o.price)))}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cidade / Região */}
            <div className="space-y-2">
              <Label className="font-semibold">Cidade / Região</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Ex: Curitiba e Região, Interior do Paraná..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-9 bg-gray-50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Descrição opcional para identificar a região atendida.
              </p>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label className="font-semibold">
                Valor do Frete (R$) <span className="text-red-500">*</span>
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
                  = {formatCurrency(parseFloat(price))}
                </p>
              )}
            </div>

            {/* Preview */}
            {isCepFormatValid(cepStart) && isCepFormatValid(cepEnd) && price && !cepWarning && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                <p className="text-indigo-700 font-semibold mb-2 flex items-center gap-1">
                  <Package className="w-4 h-4" /> Resumo da faixa
                </p>
                <div className="space-y-1 text-indigo-800">
                  <p><strong>Transportadora:</strong> {transportadora === "Outra" ? customTransportadora || "—" : transportadora}</p>
                  <p><strong>CEPs:</strong> <span className="font-mono">{cepStart}</span> → <span className="font-mono">{cepEnd}</span></p>
                  {city && <p><strong>Região:</strong> {city}</p>}
                  <p className="text-base font-bold text-indigo-900 mt-1">
                    {formatCurrency(parseFloat(price))}
                  </p>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setIsZoneModalOpen(false); resetForm(); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !isFormValid()
                }
                className="flex-1 font-bold bg-indigo-600 hover:bg-indigo-700"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : selectedZone
                  ? "Salvar Alterações"
                  : "Adicionar Faixa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileDown, Download, Loader2, Trash2, Plus, Users } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from 'xlsx';
import { format } from "date-fns";

// --- Tipos ---
interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string | null;
  shipping_address: any;
  user_id: string | null;
  email?: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    cpf_cnpj: string | null;
  } | null;
  delivery_info?: string | null;
}

interface Sender {
  id: string;
  name?: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

const SENDERS_STORAGE_KEY = "print_labels_senders_v1";

export default function PrintLabelsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  // Removed orders storage (persisted so downloads can be filtered out)
  const REMOVED_STORAGE_KEY = "print_labels_removed_orders_v1";
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());

  // Export confirmation dialog state
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [exportPreviewOrders, setExportPreviewOrders] = useState<Order[]>([]);

  // State for dialog
  const [isAddSenderDialogOpen, setIsAddSenderDialogOpen] = useState(false);
  // State for delete confirmation dialog
  const [senderToDelete, setSenderToDelete] = useState<Sender | null>(null);

  // State for tabs
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");

  // Configurações do Remetente (Estado Local - Carregado do Banco para fallback)
  const [senderInfo, setSenderInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    cep: ""
  });

  // Lista de remetentes cadastrados (persistidos em localStorage)
  const [senders, setSenders] = useState<Sender[]>([]);

  // Campos temporários para criar novo remetente
  const [newSender, setNewSender] = useState<Sender>({
    id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    cep: ""
  });

  // refetchRef é usado para armazenar a função refetch do react-query.
  // Declaramos aqui, antes das queries, para evitar erro de 'used before declaration'.
  const refetchRef = useRef<(() => Promise<any>) | undefined>(undefined);

  useEffect(() => {
    // Carregar remetentes do localStorage ao montar
    try {
      const raw = localStorage.getItem(SENDERS_STORAGE_KEY);
      console.log("[PrintLabels] Carregando remetentes do localStorage:", raw);
      if (raw) {
        const parsed: Sender[] = JSON.parse(raw);
        console.log("[PrintLabels] Remetentes carregados:", parsed.length, parsed);
        setSenders(parsed);
      } else {
        console.log("[PrintLabels] Nenhum remetente encontrado no localStorage");
      }
    } catch (e) {
      console.error("Erro ao carregar remetentes do localStorage", e);
    }
  }, []);

  // Load removed order ids from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMOVED_STORAGE_KEY);
      if (raw) {
        const parsed: number[] = JSON.parse(raw);
        setRemovedIds(new Set(parsed));
      }
    } catch (e) {
      console.error("Erro ao carregar pedidos removidos do localStorage", e);
    }
  }, []);

  const persistRemovedIds = (next: Set<number>) => {
    try {
      localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error("Erro ao persistir pedidos removidos", e);
    }
  };

  useEffect(() => {
    // Garantir id para newSender ao abrir form
    if (!newSender.id) setNewSender(s => ({ ...s, id: crypto.randomUUID?.() || String(Date.now()) }));
  }, [newSender.id]);

  // 1. Buscar Configurações do Remetente (Silencioso para uso na exportação)
  useQuery({
    queryKey: ["senderSettingsExport"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["sender_name", "sender_address", "sender_city", "sender_state", "sender_cep"]);

      const settings: any = {};
      data?.forEach(s => (settings[s.key] = s.value));

      setSenderInfo({
        name: settings.sender_name || "Minha Loja",
        address: settings.sender_address || "",
        city: settings.sender_city || "",
        state: settings.sender_state || "",
        cep: settings.sender_cep || ""
      });
      return settings;
    }
  });

  // 2. Buscar Pedidos (somente os campos que precisamos)
  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["ordersForExcelExport"],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_price,
          status,
          delivery_status,
          shipping_address,
          user_id
        `)
        // status pago/finalizado e delivery_status Aguardando Coleta ou Pendente
        .in("status", ["Finalizada", "Pago"])
        .or("delivery_status.eq.Aguardando Coleta,delivery_status.eq.Pendente,delivery_status.eq.Embalado")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar pedidos para export:", error);
        throw error;
      }

      if (!ordersData || ordersData.length === 0) return [];

      // Buscar perfis separadamente por user_ids (evita problemas de join/RLS)
      const userIds = Array.from(new Set(ordersData.map((o: any) => o.user_id).filter(Boolean)));
      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, phone, cpf_cnpj")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((p: any) => profilesMap.set(String(p.id), p));
        } else if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
        }
      }

      // Buscar emails via edge function dedicada (envia os user_ids e recebe emails)
      let emailMap = new Map<string, string>();
      try {
        const { data: emailsData, error: emailsError } = await supabase.functions.invoke("get-users-emails", {
          body: { user_ids: userIds }
        });
        if (emailsError) {
          console.error("get-users-emails retornou erro:", emailsError);
        } else if (Array.isArray(emailsData)) {
          emailsData.forEach((u: any) => {
            if (u.id && u.email) emailMap.set(u.id, u.email);
          });
          console.log(`[PrintLabels] Emails carregados: ${emailMap.size} de ${userIds.length}`);
        }
      } catch (e) {
        console.error("get-users-emails edge function falhou:", e);
      }

      return ordersData.map((o: any) => ({
        ...o,
        profiles: o.user_id ? profilesMap.get(String(o.user_id)) ?? null : null,
        email: o.user_id ? (emailMap.get(o.user_id) || "") : ""
      }));
    },
    staleTime: 0
  });

  // ligar refetch do react-query ao ref usado nas funções acima
  refetchRef.current = refetch;

  // Filtragem local (aplica remoções persistidas)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const term = searchTerm.trim().toLowerCase();
    const base = orders.filter(o => !removedIds.has(o.id));
    if (!term) return base;
    return base.filter(o => {
      const p = o.profiles;
      return (
        String(o.id).includes(term) ||
        p?.first_name?.toLowerCase().includes(term) ||
        p?.last_name?.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, removedIds]);

  // Seleção
  const toggleSelectAll = () => {
    if (!orders) return;
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Botões adicionais: limpar selecionados da lista (persistido) e atualizar pedidos
  const handleClearSelected = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }
    const count = selectedIds.size;
    const next = new Set(removedIds);
    selectedIds.forEach(id => next.add(id));
    setRemovedIds(next);
    persistRemovedIds(next);
    // limpar seleção
    setSelectedIds(new Set());
    showSuccess(`${count} pedido(s) removido(s) da lista.`);
  };

  const handleRefresh = async () => {
    try {
      if (refetchRef.current) {
        await refetchRef.current();
        showSuccess("Pedidos atualizados.");
      } else {
        showError("Não foi possível atualizar no momento.");
      }
    } catch (e) {
      console.error("Erro ao atualizar pedidos:", e);
      showError("Erro ao atualizar pedidos.");
    }
  };

  // Funções de gerência de remetentes (persistência local)
  const persistSenders = (next: Sender[]) => {
    try {
      console.log("[PrintLabels] Salvando remetentes no localStorage:", next.length, "itens");
      localStorage.setItem(SENDERS_STORAGE_KEY, JSON.stringify(next));
      console.log("[PrintLabels] Remetentes salvos com sucesso");
    } catch (e) {
      console.error("Erro ao salvar remetentes no localStorage", e);
    }
  };

  const handleAddSender = () => {
    // validação mínima: endereço e cidade
    if (!newSender.address.trim() || !newSender.city.trim()) {
      showError("Preencha pelo menos Endereço e Cidade do remetente.");
      return;
    }
    const senderToAdd: Sender = {
      ...newSender,
      id: newSender.id || (crypto.randomUUID?.() || String(Date.now()))
    };
    const next = [...senders, senderToAdd];
    setSenders(next);
    persistSenders(next);
    // limpar form mantendo id novo
    setNewSender({ id: crypto.randomUUID?.() || String(Date.now()), name: "", address: "", city: "", state: "", cep: "" });
    showSuccess("Remetente adicionado.");
    setIsAddSenderDialogOpen(false);
  };

  const handleRemoveSender = (id: string) => {
    // Find the sender being deleted
    const sender = senders.find(s => s.id === id);
    if (!sender) {
      showError("Remetente não encontrado.");
      return;
    }
    // Show confirmation dialog
    setSenderToDelete(sender);
  };

  const confirmRemoveSender = () => {
    if (!senderToDelete) return;
    console.log("[PrintLabels] Removendo remetente:", senderToDelete);
    const next = senders.filter(s => s.id !== senderToDelete.id);
    setSenders(next);
    persistSenders(next);
    setSenderToDelete(null);
    showSuccess("Remetente removido.");
  };

  // Util helpers
  const cleanStr = (val: string | null | undefined) => val || "";
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Cabeçalho da planilha (ordem deve bater com o modelo)
  const TEMPLATE_HEADERS = [
    "Número do pedido",
    "Endereço",
    "Complemento",
    "_blank1",
    "Telefone",
    "Observação",
    "_blank2",
    "Cidade",
    "CEP",
    "_blank3",
    "E-mail",
  ];

  // Função utilitária para sortear um remetente
  const pickRandomSender = (): Sender | null => {
    if (senders.length === 0) return null;
    const idx = Math.floor(Math.random() * senders.length);
    return senders[idx];
  };

  // Prepare preview and open confirmation dialog instead of immediate export
  const handleExport = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }

    const selectedOrders = (orders ?? []).filter(o => selectedIds.has(o.id) && !removedIds.has(o.id));
    if (selectedOrders.length === 0) {
      showError("Nenhum pedido selecionado disponível para exportação.");
      return;
    }

    // set preview and open dialog
    setExportPreviewOrders(selectedOrders);
    setIsExportConfirmOpen(true);
  };

  const performExport = async (selectedOrders: Order[], removeAfterExport: boolean) => {
    setIsExporting(true);
    try {
      const exportData = selectedOrders.map(order => {
        const p = order.profiles;
        const addr = order.shipping_address || {};

        const sender = pickRandomSender();
        const remName = sender?.name || senderInfo.name || "Minha Loja";
        const remAddress = sender?.address || senderInfo.address || "";
        const remCity = sender?.city || senderInfo.city || "";
        const remState = sender?.state || senderInfo.state || "";
        const remCep = sender?.cep || senderInfo.cep || "";

        return {
          "Número do pedido": order.id,
          "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
          "Complemento": addr.complement || "",
          "_blank1": "",
          "Telefone": p?.phone || "",
          "Observação": "Frágil",
          "_blank2": "",
          "Cidade": addr.city || "",
          "CEP": addr.cep || "",
          "_blank3": "",
          "E-mail": order.email || "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData, { header: TEMPLATE_HEADERS });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");

      const fileName = `Envios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      // if requested, persist removal so orders disappear from table
      if (removeAfterExport) {
        const next = new Set(removedIds);
        selectedOrders.forEach(o => next.add(o.id));
        setRemovedIds(next);
        persistRemovedIds(next);
        // also clear selection of removed ids
        const nextSelected = new Set(selectedIds);
        selectedOrders.forEach(o => nextSelected.delete(o.id));
        setSelectedIds(nextSelected);
      }

      showSuccess(`${selectedOrders.length} pedidos exportados!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar Excel.");
    } finally {
      setIsExporting(false);
      setIsExportConfirmOpen(false);
      setExportPreviewOrders([]);
    }
  };

  // BAIXAR EXEMPLO
  const handleDownloadTemplate = () => {
    const sample = [
      {
        "Número do pedido": "12345",
        "Endereço": "Rua das Flores, 123",
        "Complemento": "Apto 101",
        "_blank1": "",
        "Telefone": "11999999999",
        "Observação": "Frágil",
        "_blank2": "",
        "Cidade": "São Paulo",
        "CEP": "01000-000",
        "_blank3": "",
        "E-mail": "joao@email.com",
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_envios.xlsx");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8 text-green-600" />
          Exportação de Etiquetas
        </h1>
        <p className="text-muted-foreground">
          Gere planilhas para envio com dados completos de remetente e destinatário.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: actions */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-11 rounded-md" onClick={handleDownloadTemplate}>
                  <FileDown className="w-4 h-4 mr-3 text-gray-500" />
                  Baixar Planilha de Exemplo
                </Button>

                <Button 
                  className={`w-full justify-start h-11 rounded-md ${selectedIds.size === 0 ? "opacity-60" : ""}`}
                  onClick={handleExport}
                  disabled={isExporting || selectedIds.size === 0}
                >
                  {isExporting ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                  Exportar Selecionados ({selectedIds.size})
                </Button>

                {selectedIds.size > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 justify-center h-10" onClick={handleRefresh}>
                      <Loader2 className="w-4 h-4 mr-2" />
                      Atualizar
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-700 text-white flex-1 justify-center h-10" onClick={handleClearSelected}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar da lista ({selectedIds.size})
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: remetentes */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Remetentes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "add")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Listar
                  </TabsTrigger>
                  <TabsTrigger value="add" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Cadastrar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-4">
                  <div className="space-y-2">
                    {senders.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum remetente cadastrado — usaremos os dados padrões do sistema.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {senders.map(s => (
                          <div key={s.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                            <div className="text-sm">
                              <div className="font-medium">{s.name || "(sem nome)"}</div>
                              <div className="text-xs text-muted-foreground">{s.address} — {s.city}{s.state ? ` / ${s.state}` : ""} {s.cep ? `• ${s.cep}` : ""}</div>
                            </div>
                            <div>
                              <Button variant="ghost" onClick={() => handleRemoveSender(s.id)} title="Remover remetente" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="add" className="mt-4">
                  <Button 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 rounded-md flex items-center justify-center" 
                    onClick={() => setIsAddSenderDialogOpen(true)}
                  >
                    <Plus className="mr-2" /> Adicionar Remetente
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Empty spacer (2 columns) to leave space for the table below */}
        <div className="lg:col-span-2" />

      </div>

      {/* Add Sender Dialog */}
      <Dialog open={isAddSenderDialogOpen} onOpenChange={setIsAddSenderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Remetente</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <Input 
              placeholder="Nome remetente (opcional)" 
              value={newSender.name || ""} 
              onChange={(e) => setNewSender(s => ({ ...s, name: e.target.value }))} 
              className="h-10 rounded-md"
            />
            <Input 
              placeholder="Endereço" 
              value={newSender.address} 
              onChange={(e) => setNewSender(s => ({ ...s, address: e.target.value }))} 
              className="h-10 rounded-md"
            />
            <Input 
              placeholder="Cidade" 
              value={newSender.city} 
              onChange={(e) => setNewSender(s => ({ ...s, city: e.target.value }))} 
              className="h-10 rounded-md"
            />
            <Input 
              placeholder="Estado" 
              value={newSender.state} 
              onChange={(e) => setNewSender(s => ({ ...s, state: e.target.value }))} 
              className="h-10 rounded-md"
            />
            <Input 
              placeholder="CEP" 
              value={newSender.cep} 
              onChange={(e) => setNewSender(s => ({ ...s, cep: e.target.value }))} 
              className="h-10 rounded-md"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSenderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-slate-900 hover:bg-slate-800 text-white"
              onClick={handleAddSender}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={senderToDelete !== null} onOpenChange={(open) => !open && setSenderToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja remover o remetente "{senderToDelete?.name || "(sem nome)"}"?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Endereço:</strong> {senderToDelete?.address}
              {senderToDelete?.city && <span>, {senderToDelete?.city}</span>}
              {senderToDelete?.state && <span> / {senderToDelete?.state}</span>}
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800">
                Esta ação não pode ser desfeita. O remetente será removido permanentemente da lista.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenderToDelete(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRemoveSender}
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table full width under the actions to give more space */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Pedidos prontos para etiqueta</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar por ID ou nome" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-64" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <div className="min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={toggleSelectAll} />
                    </TableHead>
                    {TEMPLATE_HEADERS.map(h => (
                      <TableHead key={h} className="whitespace-nowrap">{h.startsWith("_blank") ? "" : h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={TEMPLATE_HEADERS.length + 1} className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado com delivery_status 'Aguardando Coleta', 'Pendente' ou 'Embalado'.</TableCell>
                    </TableRow>
                  )}

                  {filteredOrders.map(order => {
                    const p = order.profiles;
                    const addr = order.shipping_address || {};
                    const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();

                    // Mapeia valores exatamente na ordem do TEMPLATE_HEADERS
                    // Para exibição na tabela usamos o mesmo mapeamento do export
                    const rowValues = (() => {
                      // escolher remetente apenas para exibição (não altera randomização no export)
                      const previewSender = senders.length > 0 ? senders[Math.floor(Math.random() * senders.length)] : null;
                      const remName = previewSender?.name || senderInfo.name;
                      const remAddress = previewSender?.address || senderInfo.address;
                      const remCity = previewSender?.city || senderInfo.city;
                      const remState = previewSender?.state || senderInfo.state;
                      const remCep = previewSender?.cep || senderInfo.cep;

                      return {
                        "Número do pedido": order.id,
                        "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
                        "Complemento": addr.complement || "",
                        "_blank1": "",
                        "Telefone": p?.phone || "",
                        "Observação": "Frágil",
                        "_blank2": "",
                        "Cidade": addr.city || "",
                        "CEP": addr.cep || "",
                        "_blank3": "",
                        "E-mail": order.email || "",
                      };
                    })();

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelectOne(order.id)} />
                        </TableCell>

                        {TEMPLATE_HEADERS.map(h => (
                          <TableCell key={h} className="whitespace-nowrap">{String(rowValues[h] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export confirmation dialog */}
      <Dialog open={isExportConfirmOpen} onOpenChange={setIsExportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exportação</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="text-sm text-muted-foreground mb-3">Você está prestes a exportar {exportPreviewOrders.length} pedido(s). Escolha uma opção:</div>

            <div className="max-h-64 overflow-auto border rounded-md p-2 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Endereço</th>
                    <th className="pb-2 pr-4">Telefone</th>
                    <th className="pb-2 pr-4">Cidade</th>
                    <th className="pb-2 pr-4">CEP</th>
                    <th className="pb-2 pr-4">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {exportPreviewOrders.slice(0, 20).map(o => {
                    const p = o.profiles;
                    const addr = o.shipping_address || {};
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="py-2 pr-4">{o.id}</td>
                        <td className="py-2 pr-4">{`${addr.street || ""}${addr.number ? `, ${addr.number}` : ""}`}</td>
                        <td className="py-2 pr-4">{p?.phone || <span className="text-red-400 italic">sem tel.</span>}</td>
                        <td className="py-2 pr-4">{addr.city || ""}</td>
                        <td className="py-2 pr-4">{addr.cep || ""}</td>
                        <td className="py-2 pr-4">
                          {o.email
                            ? o.email
                            : <span className="text-red-400 italic">sem e-mail</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {exportPreviewOrders.length > 20 && (
                <div className="text-sm text-muted-foreground pt-2 text-center">
                  ... e mais {exportPreviewOrders.length - 20} pedidos
                </div>
              )}
            </div>

            {exportPreviewOrders.some(o => !o.email) && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                <p className="text-sm text-amber-800">
                  ⚠️ {exportPreviewOrders.filter(o => !o.email).length} pedido(s) sem e-mail — a coluna ficará em branco na planilha.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsExportConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={() => performExport(exportPreviewOrders, false)} disabled={isExporting}>
                {isExporting ? "Exportando..." : "Só Exportar"}
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => performExport(exportPreviewOrders, true)} disabled={isExporting}>
                {isExporting ? "Exportando..." : "Exportar e Remover"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, FileDown, Download, Loader2, Trash2, Plus } from "lucide-react";
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

  useEffect(() => {
    // Carregar remetentes do localStorage ao montar
    try {
      const raw = localStorage.getItem(SENDERS_STORAGE_KEY);
      if (raw) {
        const parsed: Sender[] = JSON.parse(raw);
        setSenders(parsed);
      }
    } catch (e) {
      console.error("Erro ao carregar remetentes do localStorage", e);
    }
  }, []);

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
  const { data: orders, isLoading } = useQuery<Order[]>({
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
        .or("delivery_status.eq.Aguardando Coleta,delivery_status.eq.Pendente")
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

      // Tenta obter emails via edge function (não crítico)
      let emailMap = new Map<string, string>();
      try {
        const { data: usersData } = await supabase.functions.invoke("get-users");
        if (usersData) {
          usersData.forEach((u: any) => emailMap.set(u.id, u.email));
        }
      } catch (e) {
        console.debug("get-users edge function falhou (não crítico):", e);
      }

      return ordersData.map((o: any) => ({
        ...o,
        profiles: o.user_id ? profilesMap.get(String(o.user_id)) ?? null : null,
        email: o.user_id ? (emailMap.get(o.user_id) || "") : ""
      }));
    },
    staleTime: 0
  });

  // Filtragem local
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(o => {
      const p = o.profiles;
      return (
        String(o.id).includes(term) ||
        p?.first_name?.toLowerCase().includes(term) ||
        p?.last_name?.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

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

  // Funções de gerência de remetentes (persistência local)
  const persistSenders = (next: Sender[]) => {
    try {
      localStorage.setItem(SENDERS_STORAGE_KEY, JSON.stringify(next));
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
  };

  const handleRemoveSender = (id: string) => {
    const next = senders.filter(s => s.id !== id);
    setSenders(next);
    persistSenders(next);
    showSuccess("Remetente removido.");
  };

  // Util helpers
  const cleanStr = (val: string | null | undefined) => val || "";
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Cabeçalho da planilha (ordem deve bater com o modelo)
  const TEMPLATE_HEADERS = [
    "Número pedido",
    "Nome Entrega",
    "Endereço",
    "Complemento Entrega",
    "Observações",
    "Telefone Comprador",
    "Comprador",
    "F",
    "Bairro Entrega",
    "Cidade Entrega",
    "CEP Entrega",
    "CPF/CNPJ Comprador",
    "E-mail Comprador",
    "Remetente",
    "Endereço Remetente",
    "Cidade Remetente",
    "Estado Remetente",
    "CEP Remetente",
  ];

  // Função utilitária para sortear um remetente
  const pickRandomSender = (): Sender | null => {
    if (senders.length === 0) return null;
    const idx = Math.floor(Math.random() * senders.length);
    return senders[idx];
  };

  // GERAR EXCEL (agora usando remetente aleatório por pedido)
  const handleExport = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }

    setIsExporting(true);
    try {
      const selectedOrders = (orders ?? []).filter(o => selectedIds.has(o.id)) || [];

      const exportData = selectedOrders.map(order => {
        const p = order.profiles;
        const addr = order.shipping_address || {};
        const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();

        // se houver remetentes cadastrados, escolhe um aleatoriamente; caso contrário usa senderInfo
        const sender = pickRandomSender();
        const remName = sender?.name || senderInfo.name || "Minha Loja";
        const remAddress = sender?.address || senderInfo.address || "";
        const remCity = sender?.city || senderInfo.city || "";
        const remState = sender?.state || senderInfo.state || "";
        const remCep = sender?.cep || senderInfo.cep || "";

        return {
          "Número pedido": order.id,
          "Nome Entrega": fullName,
          "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
          "Complemento Entrega": addr.complement || "",
          "Observações": order.delivery_info || "",
          "Telefone Comprador": p?.phone || "",
          "Comprador": fullName,
          "F": "",
          "Bairro Entrega": addr.neighborhood || "",
          "Cidade Entrega": addr.city || "",
          "CEP Entrega": addr.cep || "",
          "CPF/CNPJ Comprador": p?.cpf_cnpj || "",
          "E-mail Comprador": order.email || "",
          "Remetente": remName,
          "Endereço Remetente": remAddress,
          "Cidade Remetente": remCity,
          "Estado Remetente": remState,
          "CEP Remetente": remCep
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData, { header: TEMPLATE_HEADERS });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");

      const fileName = `Envios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showSuccess(`${selectedOrders.length} pedidos exportados!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // BAIXAR EXEMPLO
  const handleDownloadTemplate = () => {
    const sample = [
      {
        "Número pedido": "12345",
        "Nome Entrega": "João Silva",
        "Endereço": "Rua das Flores, 123",
        "Complemento Entrega": "Apto 101",
        "Observações": "Frágil",
        "Telefone Comprador": "11999999999",
        "Comprador": "João Silva",
        "F": "",
        "Bairro Entrega": "Centro",
        "Cidade Entrega": "São Paulo",
        "CEP Entrega": "01000-000",
        "CPF/CNPJ Comprador": "123.456.789-00",
        "E-mail Comprador": "joao@email.com",
        "Remetente": "Minha Loja",
        "Endereço Remetente": "Av Paulista, 1000",
        "Cidade Remetente": "São Paulo",
        "Estado Remetente": "SP",
        "CEP Remetente": "01310-100"
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
        {/* Left column: actions + remetentes */}
        <div className="lg:col-span-1 space-y-4">
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Remetentes (cadastre vários)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm text-muted-foreground">Cadastre múltiplos remetentes; ao exportar cada pedido receberá aleatoriamente um deles.</div>

              <div className="grid grid-cols-1 gap-2">
                <Input className="h-10 rounded-md" placeholder="Nome remetente (opcional)" value={newSender.name || ""} onChange={(e) => setNewSender(s => ({ ...s, name: e.target.value }))} />
                <Input className="h-10 rounded-md" placeholder="Endereço" value={newSender.address} onChange={(e) => setNewSender(s => ({ ...s, address: e.target.value }))} />
                <Input className="h-10 rounded-md" placeholder="Cidade" value={newSender.city} onChange={(e) => setNewSender(s => ({ ...s, city: e.target.value }))} />
                <Input className="h-10 rounded-md" placeholder="Estado" value={newSender.state} onChange={(e) => setNewSender(s => ({ ...s, state: e.target.value }))} />
                <Input className="h-10 rounded-md" placeholder="CEP" value={newSender.cep} onChange={(e) => setNewSender(s => ({ ...s, cep: e.target.value }))} />
                <div className="flex items-center gap-3 mt-1">
                  <Button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-11 rounded-md flex items-center justify-center" onClick={handleAddSender}>
                    <Plus className="mr-2" /> Adicionar Remetente
                  </Button>
                  <Button variant="outline" className="h-11 rounded-md" onClick={() => { setNewSender({ id: crypto.randomUUID?.() || String(Date.now()), name: "", address: "", city: "", state: "", cep: "" }); }}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="mt-2">
                <div className="text-sm font-medium mb-2">Remetentes cadastrados</div>
                {senders.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum remetente cadastrado — usaremos os dados padrões do sistema.</div>
                ) : (
                  <div className="space-y-2">
                    {senders.map(s => (
                      <div key={s.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <div className="text-sm">
                          <div className="font-medium">{s.name || "(sem nome)"}</div>
                          <div className="text-xs text-muted-foreground">{s.address} — {s.city}{s.state ? ` / ${s.state}` : ""} {s.cep ? `• ${s.cep}` : ""}</div>
                        </div>
                        <div>
                          <Button variant="ghost" onClick={() => handleRemoveSender(s.id)} title="Remover remetente">
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty spacer so actions stay left on wide screens */}
        <div className="lg:col-span-3" />

      </div>

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
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={TEMPLATE_HEADERS.length + 1} className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado com delivery_status 'Aguardando Coleta' ou 'Pendente'.</TableCell>
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
                        "Número pedido": order.id,
                        "Nome Entrega": fullName,
                        "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
                        "Complemento Entrega": addr.complement || "",
                        "Observações": order.delivery_info || "",
                        "Telefone Comprador": p?.phone || "",
                        "Comprador": fullName,
                        "F": "",
                        "Bairro Entrega": addr.neighborhood || "",
                        "Cidade Entrega": addr.city || "",
                        "CEP Entrega": addr.cep || "",
                        "CPF/CNPJ Comprador": p?.cpf_cnpj || "",
                        "E-mail Comprador": order.email || "",
                        "Remetente": remName,
                        "Endereço Remetente": remAddress,
                        "Cidade Remetente": remCity,
                        "Estado Remetente": remState,
                        "CEP Remetente": remCep
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
    </div>
  );
}
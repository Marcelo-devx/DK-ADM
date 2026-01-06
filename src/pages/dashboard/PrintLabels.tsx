"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, QrCode, Phone, Truck, Package, Settings2, Image as ImageIcon, MapPin, Save, Search, CheckCircle2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploader } from "@/components/dashboard/ImageUploader";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge"; // Importação adicionada

// Types
interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string;
  shipping_address: any;
  user_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

interface OrderItem {
  name_at_purchase: string;
  quantity: number;
}

const PrintLabelsPage = () => {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Configurações do Remetente (Mapeamento)
  const [senderInfo, setSenderInfo] = useState({
    name: "Sua Loja",
    address: "Rua Exemplo, 100",
    city: "São Paulo / SP",
    logo_url: ""
  });

  // Queries
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["ordersToPrint"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, created_at, total_price, status, delivery_status, shipping_address, user_id,
          profiles (first_name, last_name, phone)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: orderItems, isLoading: isLoadingItems } = useQuery<OrderItem[]>({
    queryKey: ["orderItemsForPrint", selectedOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("name_at_purchase, quantity")
        .eq("order_id", selectedOrderId!);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrderId,
  });

  const { data: savedSettings } = useQuery({
    queryKey: ["labelSettings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["label_sender_name", "label_sender_address", "label_sender_city", "label_logo_url"]);
      
      if (data) {
        const settings: any = {};
        data.forEach(s => settings[s.key] = s.value);
        setSenderInfo({
          name: settings.label_sender_name || "Tabacaria Oficial",
          address: settings.label_sender_address || "Av. Principal, 1000",
          city: settings.label_sender_city || "São Paulo / SP",
          logo_url: settings.label_logo_url || ""
        });
      }
      return data;
    }
  });

  // Mutations
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "label_sender_name", value: senderInfo.name },
        { key: "label_sender_address", value: senderInfo.address },
        { key: "label_sender_city", value: senderInfo.city },
        { key: "label_logo_url", value: senderInfo.logo_url }
      ];
      const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Configurações de impressão salvas!"),
    onError: (err: any) => showError(`Erro: ${err.message}`),
  });

  const selectedOrder = orders?.find(o => String(o.id) === selectedOrderId);

  const handlePrint = () => {
    if (!selectedOrderId) {
      showError("Selecione um pedido primeiro.");
      return;
    }
    window.print();
  };

  const filteredOrders = orders?.filter(o => 
    o.id.toString().includes(searchTerm) || 
    o.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)]">
      
      {/* COLUNA ESQUERDA: LISTA DE PEDIDOS */}
      <div className="w-full lg:w-80 space-y-4 print:hidden">
        <Card className="h-full flex flex-col">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Search className="w-4 h-4" /> Selecionar Pedido
            </CardTitle>
            <Input 
              placeholder="Buscar por ID ou Nome..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2 h-8 text-xs"
            />
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
            {isLoadingOrders ? (
              <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : filteredOrders?.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(String(order.id))}
                className={cn(
                  "w-full text-left p-3 border-b hover:bg-gray-50 transition-colors flex items-center justify-between",
                  selectedOrderId === String(order.id) && "bg-primary/5 border-l-4 border-l-primary"
                )}
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-sm">#{order.id}</p>
                  <p className="text-[10px] text-muted-foreground uppercase truncate w-40">
                    {order.profiles?.first_name} {order.profiles?.last_name}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                    <Badge variant="outline" className="text-[9px] h-4">
                        {order.status}
                    </Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ÁREA CENTRAL: PRÉVIA DA ETIQUETA */}
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between print:hidden">
            <h2 className="text-lg font-bold flex items-center gap-2"><Printer className="w-5 h-5 text-primary" /> Visualização da Etiqueta</h2>
            <Button onClick={handlePrint} disabled={!selectedOrderId} className="bg-black hover:bg-gray-800 font-bold">
                <Printer className="w-4 h-4 mr-2" /> Imprimir Selecionado
            </Button>
        </div>

        {selectedOrder ? (
          <div className="bg-white p-8 rounded-xl shadow-2xl border w-full max-w-[450px] print:p-0 print:shadow-none print:border-none print:m-0" id="label-container">
            {/* ETIQUETA PROFISSIONAL */}
            <div className="border-2 border-black p-4 w-full text-black font-sans bg-white" id="shipping-label">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     {senderInfo.logo_url ? (
                         <img src={senderInfo.logo_url} alt="Logo" className="h-10 object-contain" />
                     ) : (
                         <div className="bg-black text-white p-1 rounded font-black text-xl italic leading-none">T</div>
                     )}
                     <span className="font-black text-xl uppercase tracking-tighter italic">{senderInfo.name}</span>
                  </div>
                  <span className="font-mono text-2xl font-black mt-2">#{selectedOrder.id}</span>
                </div>
                
                <div className="border-2 border-black p-1 bg-white">
                  <QrCode className="w-16 h-16" strokeWidth={1} />
                  <p className="text-[8px] text-center font-bold font-mono">TRACKING</p>
                </div>

                <div className="text-right">
                   <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center">
                      <Truck className="w-8 h-8" />
                   </div>
                   <p className="text-[10px] font-black uppercase mt-1">Expresso</p>
                </div>
              </div>

              <div className="border-y-2 border-black py-2 mb-4 flex flex-col items-center">
                 <div className="flex gap-[1px] h-12 w-full justify-center">
                   {Array.from({ length: 100 }).map((_, i) => (
                      <div key={i} className={`bg-black h-full`} style={{ width: '1px', opacity: Math.random() > 0.1 ? 1 : 0 }} />
                   ))}
                 </div>
                 <p className="text-xs font-mono font-bold mt-1 tracking-[0.5em]">PLP-{selectedOrder.id}000{selectedOrder.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
                 <div className="flex flex-col gap-1 border-b border-black pb-1">
                   <span className="font-bold">Recebedor:</span>
                 </div>
                 <div className="flex flex-col gap-1 border-b border-black pb-1">
                   <span className="font-bold">Documento:</span>
                 </div>
              </div>

              <div className="border-2 border-black mb-4">
                <div className="bg-black text-white px-2 py-0.5 flex justify-between items-center">
                  <span className="text-xs font-black uppercase italic">Destinatário:</span>
                  <span className="text-[8px] font-bold">VIP DELIVERY</span>
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-lg font-black leading-tight uppercase">
                    {selectedOrder.profiles?.first_name} {selectedOrder.profiles?.last_name}
                  </p>
                  <p className="text-sm font-bold leading-snug">
                    {selectedOrder.shipping_address.street}, {selectedOrder.shipping_address.number} {selectedOrder.shipping_address.complement && `- ${selectedOrder.shipping_address.complement}`}
                  </p>
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-sm font-medium">{selectedOrder.shipping_address.neighborhood}</p>
                        <p className="text-sm font-black">{selectedOrder.shipping_address.cep} - {selectedOrder.shipping_address.city} / {selectedOrder.shipping_address.state}</p>
                     </div>
                     <div className="text-right flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span className="text-xs font-bold">{selectedOrder.profiles?.phone || '(00) 00000-0000'}</span>
                     </div>
                  </div>
                </div>
              </div>

              <div className="border border-black border-dashed p-2 mb-4 bg-gray-50">
                 <p className="text-[9px] font-black uppercase mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Conferência de Conteúdo:
                 </p>
                 <div className="space-y-1">
                    {isLoadingItems ? (
                      <Skeleton className="h-10 w-full" />
                    ) : orderItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[10px] border-b border-gray-200 pb-0.5 last:border-0">
                        <span className="font-medium truncate max-w-[200px]">[ ] {item.name_at_purchase}</span>
                        <span className="font-black">Qtd: {item.quantity}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="border-t-2 border-black pt-2 flex justify-between items-start">
                 <div className="flex flex-col text-[10px]">
                   <span className="font-black uppercase italic text-xs">Remetente:</span>
                   <span className="font-bold">{senderInfo.name}</span>
                   <span>{senderInfo.address}</span>
                   <span>{senderInfo.city}</span>
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl w-full max-w-[450px] bg-gray-50 min-h-[500px]">
             <div className="text-center space-y-2">
                <Printer className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-muted-foreground">Selecione um pedido na lista para pré-visualizar a etiqueta</p>
             </div>
          </div>
        )}
      </div>

      {/* COLUNA DIREITA: CONFIGURAÇÕES (MAPEAMENTO) */}
      <div className="w-full lg:w-80 space-y-4 print:hidden">
        <Card>
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Mapear Remetente
            </CardTitle>
            <CardDescription className="text-[10px]">Configure como os dados da sua loja aparecem na etiqueta.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Logotipo da Etiqueta</Label>
                <ImageUploader 
                  onUploadSuccess={(url) => setSenderInfo(prev => ({ ...prev, logo_url: url }))}
                  initialUrl={senderInfo.logo_url}
                />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome da Loja</Label>
                <Input 
                    value={senderInfo.name} 
                    onChange={(e) => setSenderInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="h-8 text-xs"
                />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Endereço de Origem</Label>
                <Input 
                    value={senderInfo.address} 
                    onChange={(e) => setSenderInfo(prev => ({ ...prev, address: e.target.value }))}
                    className="h-8 text-xs"
                />
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade / UF</Label>
                <Input 
                    value={senderInfo.city} 
                    onChange={(e) => setSenderInfo(prev => ({ ...prev, city: e.target.value }))}
                    className="h-8 text-xs"
                />
             </div>

             <Button 
                onClick={() => saveSettingsMutation.mutate()} 
                disabled={saveSettingsMutation.isPending}
                className="w-full h-8 text-xs"
                variant="outline"
             >
                <Save className="w-3 h-3 mr-2" /> {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
             </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex gap-3">
                <MapPin className="w-8 h-8 text-primary opacity-50 shrink-0" />
                <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-primary">Dica Profissional</p>
                    <p className="text-[10px] leading-tight text-primary/80">Use este logotipo para versões simplificadas em preto e branco para economizar tinta na impressão térmica.</p>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* CSS PARA IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #shipping-label, #shipping-label * {
            visibility: visible;
          }
          #shipping-label {
            position: fixed;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 100%;
            max-width: 10.5cm;
            border: 2px solid black !important;
            padding: 0.5cm !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}} />
    </div>
  );
};

export default PrintLabelsPage;
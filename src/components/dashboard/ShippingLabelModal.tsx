"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, QrCode, Mail, Phone, MapPin, Truck, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ShippingLabelModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

const fetchOrderItemsForLabel = async (orderId: number) => {
  const { data, error } = await supabase
    .from("order_items")
    .select("name_at_purchase, quantity")
    .eq("order_id", orderId);
  if (error) throw error;
  return data;
};

export const ShippingLabelModal = ({ order, isOpen, onClose }: ShippingLabelModalProps) => {
  const { data: items, isLoading } = useQuery({
    queryKey: ["orderItemsForLabel", order?.id],
    queryFn: () => fetchOrderItemsForLabel(order.id),
    enabled: !!order && isOpen,
  });

  const handlePrint = () => {
    window.print();
  };

  if (!order) return null;

  const address = order.shipping_address;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl print:shadow-none">
        <DialogHeader className="p-4 bg-gray-50 border-b print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" /> Etiqueta Profissional de Envio
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 bg-white print:p-0">
          {/* ETIQUETA FORMATADA - PADRÃO PROFISSIONAL */}
          <div className="border-2 border-black p-4 w-full text-black font-sans bg-white" id="shipping-label">
            
            {/* Header: Logo, QR Code e Ícone Serviço */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                   <div className="bg-black text-white p-1 rounded font-black text-xl italic leading-none">T</div>
                   <span className="font-black text-xl uppercase tracking-tighter italic">Tabacaria</span>
                </div>
                <span className="font-mono text-2xl font-black mt-2">#{order.id}</span>
              </div>
              
              <div className="border-2 border-black p-1 bg-white">
                <QrCode className="w-16 h-16" strokeWidth={1} />
                <p className="text-[8px] text-center font-bold font-mono">PEDIDO ID</p>
              </div>

              <div className="text-right">
                 <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center">
                    <Truck className="w-8 h-8" />
                 </div>
                 <p className="text-[10px] font-black uppercase mt-1">Envio Expresso</p>
              </div>
            </div>

            {/* Simulação de Código de Barras Principal */}
            <div className="border-y-2 border-black py-2 mb-4 flex flex-col items-center">
               <div className="flex gap-[1px] h-12 w-full justify-center">
                 {Array.from({ length: 120 }).map((_, i) => (
                    <div key={i} className={`bg-black h-full`} style={{ width: Math.random() > 0.5 ? '1px' : '2px', opacity: Math.random() > 0.1 ? 1 : 0 }} />
                 ))}
               </div>
               <p className="text-xs font-mono font-bold mt-1 tracking-[0.5em]">PLP-{order.id}000{order.id}</p>
            </div>

            {/* Campos de Assinatura */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-[10px]">
               <div className="flex flex-col gap-1 border-b border-black pb-1">
                 <span className="font-bold">Recebedor:</span>
               </div>
               <div className="flex flex-col gap-1 border-b border-black pb-1">
                 <span className="font-bold">Documento:</span>
               </div>
               <div className="col-span-2 flex flex-col gap-1 border-b border-black pb-1 mt-1">
                 <span className="font-bold">Assinatura:</span>
               </div>
            </div>

            {/* Seção Destinatário */}
            <div className="border-2 border-black mb-4">
              <div className="bg-black text-white px-2 py-0.5 flex justify-between items-center">
                <span className="text-xs font-black uppercase italic">Destinatário:</span>
                <span className="text-[8px] font-bold">ENTREGA OFICIAL</span>
              </div>
              <div className="p-2 space-y-1">
                <p className="text-lg font-black leading-tight uppercase">
                  {order.profiles?.first_name} {order.profiles?.last_name}
                </p>
                <p className="text-sm font-bold leading-snug">
                  {address.street}, {address.number} {address.complement && `- ${address.complement}`}
                </p>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-sm font-medium">{address.neighborhood}</p>
                      <p className="text-sm font-black">{address.cep} - {address.city} / {address.state}</p>
                   </div>
                   <div className="text-right flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span className="text-xs font-bold">{order.profiles?.phone || '(00) 00000-0000'}</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Itens para Conferência (Estilo "Checklist") */}
            <div className="border border-black border-dashed p-2 mb-4 bg-gray-50">
               <p className="text-[9px] font-black uppercase mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Conteúdo do Volume:
               </p>
               <div className="space-y-1">
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px] border-b border-gray-200 pb-0.5 last:border-0">
                      <span className="font-medium truncate max-w-[180px]">[ ] {item.name_at_purchase}</span>
                      <span className="font-black">Qtd: {item.quantity}</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Seção Remetente */}
            <div className="border-t-2 border-black pt-2 flex justify-between items-start">
               <div className="flex flex-col text-[10px]">
                 <span className="font-black uppercase italic text-xs">Remetente:</span>
                 <span className="font-bold">TABACARIA OFICIAL</span>
                 <span>Rua das Entregas, 100 - Centro</span>
                 <span>São Paulo / SP</span>
               </div>
               <div className="flex flex-col items-center">
                  <div className="flex gap-[0.5px] h-6 w-24 bg-black/5 p-0.5">
                    {Array.from({ length: 40 }).map((_, i) => (
                       <div key={i} className="bg-black h-full" style={{ width: '1px' }} />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono font-bold">{address.cep?.replace('-', '')}</span>
               </div>
            </div>

            <div className="mt-4 text-[7px] text-center border-t border-gray-300 pt-1 leading-tight text-gray-500 italic">
               Importante: O transportador não é responsável pelos bens entregues e/ou conteúdo contido neste pacote. 
               Verifique a integridade da embalagem no ato do recebimento.
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-6 print:hidden">
            <Button onClick={handlePrint} className="w-full bg-black hover:bg-gray-800 text-white font-bold h-12 text-lg">
              <Printer className="w-5 h-5 mr-2" /> Imprimir Agora
            </Button>
            <Button variant="ghost" onClick={onClose} className="w-full text-gray-500">
              Fechar Visualização
            </Button>
          </div>
        </div>

        {/* CSS para Impressão */}
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
      </DialogContent>
    </Dialog>
  );
};
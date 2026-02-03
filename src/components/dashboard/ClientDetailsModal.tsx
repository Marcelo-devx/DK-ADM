import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, MapPin, Phone, Calendar, Shield, Star, 
  Mail, Award, CreditCard, History, Fingerprint, 
  ShoppingBag, Package, ChevronRight 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ClientDetailsModalProps {
  client: any | null; // Cliente da lista (contém email e stats básicos)
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  // Query do Perfil (Dados Pessoais)
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["clientProfileFull", client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, loyalty_tiers(name)")
        .eq("id", client.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && isOpen,
  });

  // Query dos Pedidos (Histórico)
  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["clientOrdersHistory", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, 
          created_at, 
          total_price, 
          status, 
          payment_method,
          order_items (
            name_at_purchase,
            quantity,
            price_at_purchase,
            image_url_at_purchase
          )
        `)
        .eq("user_id", client.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && isOpen,
  });

  if (!client) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Finalizada': return <Badge className="bg-green-600">Finalizada</Badge>;
        case 'Pago': return <Badge className="bg-green-600">Pago</Badge>;
        case 'Cancelado': return <Badge variant="destructive">Cancelado</Badge>;
        case 'Pendente': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50/50">
        <DialogHeader className="p-6 pb-2 bg-white border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-6 w-6 text-primary" /> Detalhes do Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-6 pb-0 bg-white">
                {/* CABEÇALHO DO PERFIL */}
                <div className="flex items-start justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                    <div className="flex gap-4">
                        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl border-4 border-white shadow-sm">
                            {client.first_name?.[0]?.toUpperCase() || <User />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {client.first_name} {client.last_name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                <Mail className="w-3 h-3" /> {client.email || profile?.email || "..."}
                            </div>
                            <div className="flex gap-2 mt-2">
                                {profile?.role === 'adm' && <Badge className="bg-red-500">Administrador</Badge>}
                                {client.force_pix_on_next_purchase ? (
                                    <Badge variant="destructive" className="flex gap-1 items-center"><Shield className="w-3 h-3" /> Restrito (Pix)</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 flex gap-1 items-center"><CreditCard className="w-3 h-3" /> Cartão Liberado</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Cliente desde</p>
                        <p className="text-sm font-medium">{formatDate(client.created_at || profile?.created_at)}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="orders" className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="px-6 border-b">
                    <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                        <TabsTrigger value="orders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full font-bold text-slate-500 data-[state=active]:text-primary bg-transparent">
                            Histórico de Pedidos ({orders?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full font-bold text-slate-500 data-[state=active]:text-primary bg-transparent">
                            Dados Pessoais
                        </TabsTrigger>
                    </TabsList>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <TabsContent value="details" className="mt-0 space-y-6">
                            {isLoadingProfile ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-20 w-full" />
                                </div>
                            ) : (
                                <>
                                    {/* DADOS PESSOAIS */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3 p-4 border rounded-lg bg-white shadow-sm">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b pb-2 mb-2">
                                                <Fingerprint className="w-4 h-4 text-slate-400" /> Dados Pessoais
                                            </h4>
                                            <div className="grid grid-cols-2 gap-y-3 text-sm">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">CPF / CNPJ</p>
                                                    <p className="font-medium">{profile?.cpf_cnpj || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Telefone</p>
                                                    <div className="flex items-center gap-1 font-medium">
                                                        <Phone className="w-3 h-3 text-slate-400" /> {profile?.phone || "-"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Nascimento</p>
                                                    <div className="flex items-center gap-1 font-medium">
                                                        <Calendar className="w-3 h-3 text-slate-400" /> {formatDate(profile?.date_of_birth)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Gênero</p>
                                                    <p className="font-medium">{profile?.gender || "-"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ENDEREÇO */}
                                        <div className="space-y-3 p-4 border rounded-lg bg-white shadow-sm">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b pb-2 mb-2">
                                                <MapPin className="w-4 h-4 text-slate-400" /> Endereço Principal
                                            </h4>
                                            <div className="text-sm space-y-1">
                                                <p className="font-medium">
                                                    {profile?.street ? `${profile.street}, ${profile.number}` : "Endereço não cadastrado"}
                                                </p>
                                                {profile?.complement && <p className="text-slate-500">{profile.complement}</p>}
                                                {profile?.neighborhood && (
                                                    <p className="text-slate-600">
                                                        {profile.neighborhood} - {profile.city}/{profile.state}
                                                    </p>
                                                )}
                                                {profile?.cep && <p className="text-slate-500 text-xs">CEP: {profile.cep}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* FIDELIDADE E STATS */}
                                    <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg">
                                        <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2 mb-4">
                                            <Award className="w-4 h-4" /> Club DK & Estatísticas
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                            <div className="bg-white p-3 rounded shadow-sm border border-yellow-100">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Nível Atual</p>
                                                <p className="font-black text-yellow-600 flex items-center justify-center gap-1">
                                                    <Star className="w-3 h-3 fill-current" /> {profile?.current_tier_name || "Bronze"}
                                                </p>
                                            </div>
                                            <div className="bg-white p-3 rounded shadow-sm border border-yellow-100">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Pontos</p>
                                                <p className="font-black text-slate-800">{profile?.points || 0}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded shadow-sm border border-yellow-100">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Pedidos</p>
                                                <p className="font-black text-blue-600 flex items-center justify-center gap-1">
                                                    <History className="w-3 h-3" /> {orders?.length || 0}
                                                </p>
                                            </div>
                                            <div className="bg-white p-3 rounded shadow-sm border border-yellow-100">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Gasto (6 meses)</p>
                                                <p className="font-black text-green-600">{formatCurrency(profile?.spend_last_6_months || 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="orders" className="mt-0">
                            {isLoadingOrders ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : !orders || orders.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed">
                                    <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-muted-foreground">Nenhum pedido encontrado para este cliente.</p>
                                </div>
                            ) : (
                                <Accordion type="single" collapsible className="w-full space-y-2">
                                    {orders.map((order: any) => (
                                        <AccordionItem key={order.id} value={String(order.id)} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                                            <AccordionTrigger className="px-4 py-3 hover:bg-slate-50 hover:no-underline">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="font-bold text-sm flex items-center gap-2">
                                                            Pedido #{order.id}
                                                            {getStatusBadge(order.status)}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" /> {formatDateTime(order.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-black text-slate-800">{formatCurrency(order.total_price)}</span>
                                                        <p className="text-[10px] text-muted-foreground uppercase">{order.payment_method || 'Pix'}</p>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-4 pb-4 bg-slate-50/50 border-t">
                                                <div className="pt-3 space-y-3">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                        <Package className="w-3 h-3" /> Itens Comprados ({order.order_items.length})
                                                    </p>
                                                    <div className="space-y-2">
                                                        {order.order_items.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded border border-slate-100">
                                                                {item.image_url_at_purchase ? (
                                                                    <img src={item.image_url_at_purchase} alt="" className="w-10 h-10 rounded object-cover border" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center border">
                                                                        <ShoppingBag className="w-4 h-4 text-slate-300" />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.name_at_purchase}</p>
                                                                    <p className="text-xs text-slate-500">
                                                                        {item.quantity} un. x {formatCurrency(item.price_at_purchase)}
                                                                    </p>
                                                                </div>
                                                                <div className="font-bold text-sm text-slate-700">
                                                                    {formatCurrency(item.quantity * item.price_at_purchase)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </TabsContent>
                    </div>
                </ScrollArea>
            </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
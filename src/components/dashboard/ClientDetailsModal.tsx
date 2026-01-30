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
  Mail, Award, CreditCard, History, Fingerprint 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientDetailsModalProps {
  client: any | null; // Cliente da lista (contém email e stats básicos)
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDetailsModal = ({ client, isOpen, onClose }: ClientDetailsModalProps) => {
  const { data: profile, isLoading } = useQuery({
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

  if (!client) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-6 w-6 text-primary" /> Detalhes do Cliente
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-6">
            {/* CABEÇALHO DO PERFIL */}
            <div className="flex items-start justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex gap-4">
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl border-4 border-white shadow-sm">
                        {client.first_name?.[0]?.toUpperCase() || <User />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {client.first_name} {client.last_name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <Mail className="w-3 h-3" /> {client.email}
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
                <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Cliente desde</p>
                    <p className="text-sm font-medium">{formatDate(client.created_at)}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : (
                <>
                    {/* DADOS PESSOAIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 p-4 border rounded-lg">
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
                        <div className="space-y-3 p-4 border rounded-lg">
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
                            <div className="bg-white p-3 rounded shadow-sm">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Nível Atual</p>
                                <p className="font-black text-yellow-600 flex items-center justify-center gap-1">
                                    <Star className="w-3 h-3 fill-current" /> {profile?.current_tier_name || "Bronze"}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Pontos</p>
                                <p className="font-black text-slate-800">{profile?.points || 0}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Pedidos</p>
                                <p className="font-black text-blue-600 flex items-center justify-center gap-1">
                                    <History className="w-3 h-3" /> {client.order_count}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Gasto (6 meses)</p>
                                <p className="font-black text-green-600">{formatCurrency(profile?.spend_last_6_months || 0)}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
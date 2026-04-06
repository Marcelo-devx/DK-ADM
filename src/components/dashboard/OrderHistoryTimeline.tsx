import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  MapPin,
  DollarSign,
  FileText,
  AlertTriangle,
  Calendar,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderHistoryTimelineProps {
  history: Array<{
    id: number;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    change_type: 'status' | 'value' | 'address' | 'cancel';
    reason: string | null;
    profiles?: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  }>;
}

export function OrderHistoryTimeline({ history }: OrderHistoryTimelineProps) {
  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'status':
        return <CheckCircle className="h-4 w-4" />;
      case 'value':
        return <DollarSign className="h-4 w-4" />;
      case 'address':
        return <MapPin className="h-4 w-4" />;
      case 'cancel':
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'status':
        return 'Status';
      case 'value':
        return 'Valor';
      case 'address':
        return 'Endereço';
      case 'cancel':
        return 'Cancelamento';
      default:
        return 'Alteração';
    }
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'status':
        return <Badge variant="default" className="bg-blue-600">Status</Badge>;
      case 'value':
        return <Badge variant="default" className="bg-green-600">Valor</Badge>;
      case 'address':
        return <Badge variant="default" className="bg-purple-600">Endereço</Badge>;
      case 'cancel':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">Alteração</Badge>;
    }
  };

  const getFieldNameLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      status: 'Status',
      delivery_status: 'Status de Entrega',
      payment_method: 'Método de Pagamento',
      total_price: 'Preço Total',
      shipping_cost: 'Custo de Frete',
      coupon_discount: 'Desconto Cupom',
      donation_amount: 'Doação',
      shipping_address: 'Endereço Completo',
      delivery_info: 'Info de Entrega',
    };
    return labels[fieldName] || fieldName;
  };

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Nenhuma alteração registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {history.map((entry, index) => (
        <div key={entry.id} className="relative">
          {/* Timeline line */}
          {index !== history.length - 1 && (
            <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-200" />
          )}

          {/* Timeline dot */}
          <div className="flex gap-4">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              entry.change_type === 'cancel' ? 'bg-red-100 text-red-600' :
              entry.change_type === 'status' ? 'bg-blue-100 text-blue-600' :
              entry.change_type === 'value' ? 'bg-green-100 text-green-600' :
              'bg-purple-100 text-purple-600'
            }`}>
              {getChangeTypeIcon(entry.change_type)}
            </div>

            <div className="flex-1 pb-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getChangeTypeBadge(entry.change_type)}
                    <h4 className="font-medium">{getFieldNameLabel(entry.field_name)}</h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(entry.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
                {/* Changed by */}
                {entry.profiles && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>
                      Por: {entry.profiles.first_name} {entry.profiles.last_name}
                      {entry.profiles.email && ` (${entry.profiles.email})`}
                    </span>
                  </div>
                )}

                {/* Values */}
                {(entry.old_value !== null || entry.new_value !== null) && (
                  <div className="space-y-1 text-sm">
                    {entry.old_value !== null && (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 line-through">
                          {entry.old_value}
                        </span>
                      </div>
                    )}
                    {entry.new_value !== null && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-600 font-medium">
                          {entry.new_value}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason */}
                {entry.reason && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{entry.reason}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

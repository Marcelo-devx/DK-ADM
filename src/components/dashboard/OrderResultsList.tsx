import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Calendar, User, Package } from "lucide-react";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface OrderResultsListProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export function OrderResultsList({ orders, onSelectOrder }: OrderResultsListProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pago":
      case "Finalizada":
        return "bg-green-600";
      case "Cancelado":
        return "bg-destructive";
      case "Pendente":
        return "bg-yellow-600";
      case "Em preparo":
        return "bg-blue-600";
      case "Enviado":
        return "bg-purple-600";
      default:
        return "default";
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum pedido encontrado com os filtros informados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {orders.length} pedido{orders.length !== 1 ? "s" : ""} encontrado{orders.length !== 1 ? "s" : ""}
      </p>
      <div className="grid gap-3">
        {orders.map((order) => (
          <Card key={order.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Pedido #{order.id}</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onSelectOrder(order)}
                      className="h-8 w-8 md:hidden"
                      title="Ver Detalhes"
                      aria-label="Ver detalhes do pedido"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  <Badge variant="outline">{order.delivery_status}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>
                      {order.profiles?.first_name} {order.profiles?.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                </div>

                {order.profiles?.email && (
                  <p className="text-sm text-muted-foreground">{order.profiles.email}</p>
                )}
              </div>

              <div className="text-right flex flex-col items-end gap-2">
                <p className="font-semibold text-lg">{formatCurrency(Number(order.total_price))}</p>
                <Button
                  size="sm"
                  onClick={() => onSelectOrder(order)}
                  className="gap-2 hidden md:inline-flex"
                >
                  <Eye className="h-4 w-4" />
                  Ver Detalhes
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
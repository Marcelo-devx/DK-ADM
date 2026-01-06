"use client";

import { useFirstOrders } from "@/hooks/useFirstOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, User, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const FirstOrdersDisplay = () => {
  const { data: firstOrders, isLoading } = useFirstOrders();
  const [isExpanded, setIsExpanded] = useState(true);

  // Removido o Skeleton que causava a "janela transparente" durante o carregamento
  if (isLoading || !firstOrders || firstOrders.length === 0) {
    return null;
  }

  const totalFirstOrders = firstOrders.length;

  return (
    <div className={cn(
      "fixed top-20 z-40 transition-all duration-300 hidden lg:block", 
      isExpanded ? "left-[17rem] w-80" : "left-[17rem] w-12" 
    )}>
      <Card className="shadow-xl border-l-4 border-green-500/50">
        <CardHeader className={cn(
          "p-3 flex flex-row items-center justify-between transition-all duration-300 bg-green-50 border-b", 
          !isExpanded && "justify-center"
        )}>
          {isExpanded ? (
            <CardTitle className="text-base flex items-center gap-2 text-green-700">
              <DollarSign className="h-4 w-4" />
              Primeiros Pedidos ({totalFirstOrders})
            </CardTitle>
          ) : (
            <DollarSign className="h-6 w-6 text-green-600" />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn("h-6 w-6 text-green-700 hover:bg-green-100", !isExpanded && "rotate-180")}
          >
            {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {isExpanded && (
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {firstOrders.map((orderData) => {
                  const order = orderData.orders;
                  if (!order) return null;

                  const customerName = order.profiles 
                    ? `${order.profiles.first_name || 'Usuário'} ${order.profiles.last_name || ''}`.trim()
                    : 'N/A';
                  
                  const formattedPrice = new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(order.total_price);

                  return (
                    <div key={orderData.order_id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="flex items-center gap-1 text-gray-800">
                          <User className="h-4 w-4 text-green-600" /> {customerName}
                        </span>
                        <span className="text-green-600 font-bold">{formattedPrice}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pedido #{orderData.order_id}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
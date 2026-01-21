"use client";

import { UserCouponsTab } from "@/components/dashboard/loyalty/UserCouponsTab";
import { TicketCheck } from "lucide-react";

const UserCouponsHistoryPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TicketCheck className="h-8 w-8 text-emerald-600" />
        <div>
            <h1 className="text-3xl font-bold">Histórico de Cupons</h1>
            <p className="text-muted-foreground">Monitore todos os resgates e a utilização dos cupons pelos clientes.</p>
        </div>
      </div>
      
      {/* Reutilizando o componente da tabela que já criamos */}
      <UserCouponsTab className="mt-0" />
    </div>
  );
};

export default UserCouponsHistoryPage;
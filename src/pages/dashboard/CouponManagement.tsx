"use client";

import { useState } from "react";
import { ClientSearch, ClientData } from "@/components/dashboard/CouponManagement/ClientSearch";
import { FreeShippingCoupon } from "@/components/dashboard/CouponManagement/FreeShippingCoupon";
import { CouponAssignment } from "@/components/dashboard/CouponManagement/CouponAssignment";
import { FirstBuyCoupon } from "@/components/dashboard/CouponManagement/FirstBuyCoupon";
import { Gift, Ticket, Sparkles } from "lucide-react";

const CouponManagementPage = () => {
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Gift className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Gestão de Cupons de Clientes</h1>
          <p className="text-muted-foreground">
            Atribua cupons para clientes específicos, crie cupons de frete grátis e configure
            promoções automáticas.
          </p>
        </div>
      </div>

      {/* Busca de Cliente */}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Buscar Cliente</h2>
        </div>
        <ClientSearch onSelectClient={setSelectedClient} selectedClient={selectedClient} />
      </div>

      {/* Cards de Ações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Frete Grátis */}
        <FreeShippingCoupon client={selectedClient} />

        {/* Card 2: Primeira Compra */}
        <FirstBuyCoupon />
      </div>

      {/* Card 3: Atribuir Cupom Existente */}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-semibold">Atribuir Cupom Existente</h2>
        </div>
        <CouponAssignment client={selectedClient} />
      </div>

    </div>
  );
};

export default CouponManagementPage;

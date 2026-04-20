import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TiersTab } from "@/components/dashboard/loyalty/TiersTab";
import { RedemptionRulesTab } from "@/components/dashboard/loyalty/RedemptionRulesTab";
import { ManualAdjustmentTab } from "@/components/dashboard/loyalty/ManualAdjustmentTab";
import { HistoryTab } from "@/components/dashboard/loyalty/HistoryTab";
import { BonusRulesTab } from "@/components/dashboard/loyalty/BonusRulesTab";
import { UserCouponsTab } from "@/components/dashboard/loyalty/UserCouponsTab";

const ClubDKAdminPage: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black">Club DK — Painel de Fidelidade</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie níveis, regras de resgate, ajustes manuais e histórico de pontos dos usuários.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações do Clube</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tiers" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg mb-4">
              <TabsTrigger value="tiers" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Níveis</TabsTrigger>
              <TabsTrigger value="redemption" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Regras de Resgate</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Ajuste Manual</TabsTrigger>
              <TabsTrigger value="history" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Histórico</TabsTrigger>
              <TabsTrigger value="bonus" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Regras de Bônus</TabsTrigger>
              <TabsTrigger value="user-coupons" className="flex-1 min-w-[calc(50%-4px)] text-xs sm:text-sm">Cupons de Usuário</TabsTrigger>
            </TabsList>

            <TabsContent value="tiers"><TiersTab /></TabsContent>
            <TabsContent value="redemption"><RedemptionRulesTab /></TabsContent>
            <TabsContent value="manual"><ManualAdjustmentTab /></TabsContent>
            <TabsContent value="history"><HistoryTab /></TabsContent>
            <TabsContent value="bonus"><BonusRulesTab /></TabsContent>
            <TabsContent value="user-coupons"><UserCouponsTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClubDKAdminPage;
import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TiersTab } from "@/components/dashboard/loyalty/TiersTab";
import { RedemptionRulesTab } from "@/components/dashboard/loyalty/RedemptionRulesTab";
import { ManualAdjustmentTab } from "@/components/dashboard/loyalty/ManualAdjustmentTab";
import { HistoryTab } from "@/components/dashboard/loyalty/HistoryTab";
import { BonusRulesTab } from "@/components/dashboard/loyalty/BonusRulesTab";
import { UserCouponsTab } from "@/components/dashboard/loyalty/UserCouponsTab";

const ClubDKAdminPage: React.FC = () => {
  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-black">Club DK — Painel de Fidelidade</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Gerencie níveis, regras de resgate, ajustes manuais e histórico de pontos.
        </p>
      </div>

      <Tabs defaultValue="tiers" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg mb-4">
          <TabsTrigger value="tiers"        className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Níveis</TabsTrigger>
          <TabsTrigger value="redemption"   className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Resgates</TabsTrigger>
          <TabsTrigger value="manual"       className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Ajuste Manual</TabsTrigger>
          <TabsTrigger value="history"      className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Histórico</TabsTrigger>
          <TabsTrigger value="bonus"        className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Bônus</TabsTrigger>
          <TabsTrigger value="user-coupons" className="flex-1 basis-[calc(50%-4px)] text-xs sm:text-sm py-2">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers"><TiersTab /></TabsContent>
        <TabsContent value="redemption"><RedemptionRulesTab /></TabsContent>
        <TabsContent value="manual"><ManualAdjustmentTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="bonus"><BonusRulesTab /></TabsContent>
        <TabsContent value="user-coupons"><UserCouponsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ClubDKAdminPage;

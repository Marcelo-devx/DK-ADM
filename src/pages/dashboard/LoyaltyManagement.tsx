"use client";

import { Crown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BonusRulesTab } from "@/components/dashboard/loyalty/BonusRulesTab";
import { TiersTab } from "@/components/dashboard/loyalty/TiersTab";
import { RedemptionRulesTab } from "@/components/dashboard/loyalty/RedemptionRulesTab";
import { UserCouponsTab } from "@/components/dashboard/loyalty/UserCouponsTab";
import { ManualAdjustmentTab } from "@/components/dashboard/loyalty/ManualAdjustmentTab";
import { HistoryTab } from "@/components/dashboard/loyalty/HistoryTab";

export default function LoyaltyManagementPage() {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Crown className="h-8 w-8 text-yellow-500" /> Gestão Club DK
            </h1>
            <p className="text-muted-foreground">Configure as regras do seu programa de fidelidade.</p>
        </div>
      </div>

      <Tabs defaultValue="bonus" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 bg-slate-100 p-1">
            <TabsTrigger value="bonus">Regras de Pontuação</TabsTrigger>
            <TabsTrigger value="tiers">Níveis</TabsTrigger>
            <TabsTrigger value="redemption">Regras de Resgate</TabsTrigger>
            <TabsTrigger value="user-coupons">Resgates Feitos</TabsTrigger>
            <TabsTrigger value="manual">Ajuste Manual</TabsTrigger>
            <TabsTrigger value="history">Extrato Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="bonus">
            <BonusRulesTab />
        </TabsContent>

        <TabsContent value="tiers">
            <TiersTab />
        </TabsContent>

        <TabsContent value="redemption">
            <RedemptionRulesTab />
        </TabsContent>

        <TabsContent value="user-coupons">
            <UserCouponsTab />
        </TabsContent>

        <TabsContent value="manual">
            <ManualAdjustmentTab />
        </TabsContent>

        <TabsContent value="history">
            <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bitcoin, Wallet, RefreshCw, ShieldCheck, 
  ArrowRightLeft, AlertTriangle, Zap, QrCode 
} from "lucide-react";
import { showSuccess } from "@/utils/toast";

const CryptoPage = () => {
  // Estados apenas visuais para simulação
  const [isEnabled, setIsEnabled] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleSave = () => {
    showSuccess("Configurações salvas (Simulação). A integração será ativada no futuro.");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bitcoin className="h-8 w-8 text-orange-500" />
            Pagamentos Cripto
            </h1>
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold">
                EM BREVE
            </Badge>
        </div>
        <p className="text-muted-foreground">
          Prepare sua loja para a Web3. Receba em USDT, Bitcoin e Ethereum com liquidação automática.
        </p>
      </div>

      {/* ALERTA DE FEATURE FUTURA */}
      {!isEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                <Zap className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-bold text-blue-800">Integração em Desenvolvimento</h4>
                <p className="text-sm text-blue-700 mt-1">
                    Esta funcionalidade permitirá que seus clientes paguem usando carteiras digitais (Metamask, TrustWallet) ou Binance Pay. 
                    Ative o botão abaixo quando desejar iniciar a configuração técnica.
                </p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Gateway de Pagamento</CardTitle>
                            <CardDescription>Configure como você deseja receber os ativos.</CardDescription>
                        </div>
                        <Switch 
                            checked={isEnabled} 
                            onCheckedChange={setIsEnabled} 
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={!isEnabled ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label>Carteira de Recebimento (EVM / BSC)</Label>
                                <div className="relative">
                                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input 
                                        placeholder="0x..." 
                                        className="pl-9 font-mono bg-gray-50" 
                                        value={walletAddress}
                                        onChange={(e) => setWalletAddress(e.target.value)}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Endereço público para recebimento de USDT/USDC. Não use endereços de Exchange sem Memo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Provedor</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>Carteira Própria (DeFi)</option>
                                        <option>Binance Pay</option>
                                        <option>Coinbase Commerce</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Moeda Principal</Label>
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        <option>USDT (Tether)</option>
                                        <option>BTC (Bitcoin)</option>
                                        <option>ETH (Ethereum)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>API Key (Opcional para Binance/Coinbase)</Label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input 
                                        type="password" 
                                        placeholder="Sua chave de API..." 
                                        className="pl-9" 
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button onClick={handleSave} className="w-full mt-6 font-bold bg-orange-600 hover:bg-orange-700">
                            Salvar Configurações
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* PREVIEW DO CHECKOUT */}
            <Card className="border-dashed bg-gray-50/50">
                <CardHeader>
                    <CardTitle className="text-sm uppercase text-gray-500 font-bold">Preview do Checkout</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-white p-4 rounded-xl border shadow-sm max-w-md mx-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <span className="font-bold text-gray-700">Total a Pagar</span>
                            <span className="font-black text-xl">R$ 150,00</span>
                        </div>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-between h-12 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800">
                                <span className="flex items-center gap-2"><Bitcoin className="w-5 h-5" /> Pagar com Cripto</span>
                                <span className="text-xs bg-white px-2 py-1 rounded-full text-orange-600 font-bold">-5% OFF</span>
                            </Button>
                            <div className="text-center text-xs text-gray-400 mt-2">
                                ≈ 28.50 USDT (Cotação Atual)
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* COLUNA DIREITA: INFORMAÇÕES */}
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-gray-900 to-slate-800 text-white border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-400">
                        <Wallet className="w-5 h-5" /> Benefícios
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3 items-start">
                        <div className="bg-white/10 p-2 rounded-lg"><RefreshCw className="w-4 h-4 text-green-400" /></div>
                        <div>
                            <h4 className="font-bold text-sm">Sem Estornos</h4>
                            <p className="text-xs text-gray-400">Pagamentos em blockchain são irreversíveis. Diga adeus ao chargeback.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className="bg-white/10 p-2 rounded-lg"><ArrowRightLeft className="w-4 h-4 text-blue-400" /></div>
                        <div>
                            <h4 className="font-bold text-sm">Liquidez Global</h4>
                            <p className="text-xs text-gray-400">Receba de qualquer lugar do mundo instantaneamente.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className="bg-white/10 p-2 rounded-lg"><ShieldCheck className="w-4 h-4 text-purple-400" /></div>
                        <div>
                            <h4 className="font-bold text-sm">Privacidade</h4>
                            <p className="text-xs text-gray-400">Segurança total para você e seu cliente.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> Atenção
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-600 space-y-2">
                    <p>Esta aba é apenas um <strong>preparativo visual</strong>.</p>
                    <p>Para processar pagamentos reais, será necessário configurar Webhooks específicos e conectar a API da Binance ou um Smart Contract.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default CryptoPage;
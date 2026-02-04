"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bitcoin, Wallet, RefreshCw, ShieldCheck, ArrowRightLeft, AlertTriangle, Zap, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";

const CryptoPage = () => {
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  
  // States para Teste de Hash
  const [testHash, setTestHash] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Carregar Configurações Reais
  const { data: settings, isLoading } = useQuery({
    queryKey: ["cryptoSettings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["crypto_wallet_address", "crypto_enabled"]);
      
      const config: any = {};
      data?.forEach(s => config[s.key] = s.value);
      
      if (config.crypto_wallet_address) setWalletAddress(config.crypto_wallet_address);
      if (config.crypto_enabled) setIsEnabled(config.crypto_enabled === "true");
      
      return config;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "crypto_wallet_address", value: walletAddress },
        { key: "crypto_enabled", value: String(isEnabled) }
      ];
      const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["cryptoSettings"] });
        showSuccess("Configurações Cripto salvas com sucesso!");
    },
    onError: (err: any) => showError(err.message)
  });

  const handleValidateHash = async () => {
    if (!testHash || !walletAddress) {
        showError("Preencha a carteira e o hash para testar.");
        return;
    }
    setIsValidating(true);
    setValidationResult(null);
    try {
        const { data, error } = await supabase.functions.invoke('verify-blockchain-tx', {
            body: { 
                tx_hash: testHash, 
                wallet_address: walletAddress 
            }
        });
        if (error) throw error;
        setValidationResult(data);
        if (data.valid) showSuccess("Hash Válido!");
        else showError(data.message);
    } catch (err: any) {
        showError(err.message);
    } finally {
        setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bitcoin className="h-8 w-8 text-orange-500" />
            Pagamentos Cripto (Web3)
            </h1>
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold">
                BETA
            </Badge>
        </div>
        <p className="text-muted-foreground">
          Receba pagamentos diretos na sua carteira (Self-Custody) validando o Hash da transação.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Sua Carteira (Recebimento)</CardTitle>
                            <CardDescription>Onde os clientes devem depositar.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Habilitar no Site</Label>
                            <Switch 
                                checked={isEnabled} 
                                onCheckedChange={setIsEnabled} 
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Endereço Público (BSC / ETH / Polygon)</Label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="0x..." 
                                className="pl-9 font-mono bg-gray-50 border-orange-200 focus-visible:ring-orange-500" 
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Use um endereço compatível com EVM (começa com 0x). O sistema validará transações na rede <strong>BSC (Binance Smart Chain)</strong> por padrão.
                        </p>
                    </div>

                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full mt-4 font-bold bg-orange-600 hover:bg-orange-700">
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Salvar Configurações
                    </Button>
                </CardContent>
            </Card>

            {/* AREA DE TESTE DE HASH */}
            <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                        <Search className="w-4 h-4" /> Testar Validação de Pagamento
                    </CardTitle>
                    <CardDescription>Cole um Hash de transação real (da rede BSC) para testar se o sistema reconhece.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Cole o Hash (TxID) aqui... ex: 0x123abc..." 
                            className="font-mono text-xs bg-white"
                            value={testHash}
                            onChange={(e) => setTestHash(e.target.value)}
                        />
                        <Button onClick={handleValidateHash} disabled={isValidating || !testHash} className="bg-blue-600 hover:bg-blue-700">
                            {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
                        </Button>
                    </div>

                    {validationResult && (
                        <div className={cn("p-4 rounded-lg border", validationResult.valid ? "bg-green-100 border-green-200 text-green-800" : "bg-red-100 border-red-200 text-red-800")}>
                            <div className="flex items-center gap-2 font-bold mb-1">
                                {validationResult.valid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                {validationResult.message}
                            </div>
                            {validationResult.details && (
                                <div className="text-xs font-mono mt-2 space-y-1 opacity-80">
                                    <p>De: {validationResult.details.from}</p>
                                    <p>Valor: {validationResult.details.value_native} BNB</p>
                                    <p>Bloco: {validationResult.details.block}</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* COLUNA DIREITA: INFORMAÇÕES */}
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-gray-900 to-slate-800 text-white border-none shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-400">
                        <Wallet className="w-5 h-5" /> Self-Custody
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3 items-start">
                        <div className="bg-white/10 p-2 rounded-lg"><ShieldCheck className="w-4 h-4 text-green-400" /></div>
                        <div>
                            <h4 className="font-bold text-sm">Controle Total</h4>
                            <p className="text-xs text-gray-400">O dinheiro cai direto na sua carteira. O sistema apenas lê a blockchain para confirmar.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className="bg-white/10 p-2 rounded-lg"><ArrowRightLeft className="w-4 h-4 text-blue-400" /></div>
                        <div>
                            <h4 className="font-bold text-sm">Como Funciona?</h4>
                            <p className="text-xs text-gray-400">1. Cliente envia o valor.<br/>2. Cliente cola o Hash no checkout.<br/>3. Sistema valida e aprova.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" /> Nota Técnica
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-600 space-y-2">
                    <p>O validador atual está configurado para a rede <strong>BSC (Binance Smart Chain)</strong> e verifica transferências nativas (BNB).</p>
                    <p>Para validar Tokens (USDT/USDC), é necessário uma atualização para ler Logs de Eventos ERC-20.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default CryptoPage;
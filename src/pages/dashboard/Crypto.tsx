"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Bitcoin, Wallet, RefreshCw, ShieldCheck, ArrowRightLeft, 
  AlertTriangle, Zap, Search, CheckCircle2, XCircle, Loader2, 
  Copy, ExternalLink, Hash, FileJson, Workflow, Play, Eye, ChevronDown, ChevronRight, ArrowDownLeft 
} from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { API_URL } from "@/data/constants";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const CryptoPage = () => {
  const queryClient = useQueryClient();
  
  // -- ESTADOS GERAIS --
  const [activeTab, setActiveTab] = useState("orders");
  const [openEndpoints, setOpenEndpoints] = useState<string[]>([]);

  // -- ESTADOS DE CONFIGURAÇÃO --
  const [isEnabled, setIsEnabled] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  
  // -- ESTADOS DE TESTE --
  const [testHash, setTestHash] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  // -- DADOS DA DOCUMENTAÇÃO --
  const cryptoEndpoints = [
    { 
      id: "api_verify_tx",
      name: "Validar Transação (Blockchain)",
      method: "POST", 
      path: "/verify-blockchain-tx", 
      type: "api",
      desc: "Lê a Blockchain (BSC), procura pelo Hash e verifica se houve transferência de USDT para a sua carteira.",
      body: `{
  "tx_hash": "0x...", 
  "wallet_address": "${walletAddress || 'SUA_CARTEIRA_AQUI'}",
  "order_id": 12345 
}`,
      response: `{ 
  "valid": true, 
  "currency": "USDT",
  "amount": 50.0,
  "message": "Pagamento de 50 USDT confirmado!" 
}`
    }
  ];

  // -- QUERIES --

  // 1. Configurações
  const { data: settings } = useQuery({
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

  // 2. Pedidos Cripto (Filtrados)
  const { data: cryptoOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["cryptoOrdersOnly"],
    queryFn: async () => {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                id, created_at, total_price, status, crypto_hash, crypto_network, payment_method,
                profiles (first_name, last_name, email)
            `)
            .or('payment_method.ilike.%crypto%,payment_method.ilike.%usdt%,payment_method.ilike.%btc%')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },
    refetchInterval: 30000
  });

  // -- MUTATIONS --

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

  const handleValidateHash = async (hashToTest?: string) => {
    const hash = hashToTest || testHash;
    
    if (!hash || !walletAddress) {
        showError("Preencha a carteira e o hash para testar.");
        return;
    }
    setIsValidating(true);
    setValidationResult(null);
    try {
        const { data, error } = await supabase.functions.invoke('verify-blockchain-tx', {
            body: { 
                tx_hash: hash, 
                wallet_address: walletAddress 
            }
        });
        if (error) throw error;
        setValidationResult(data);
        if (data.valid) showSuccess("Hash Válido e Confirmado!");
        else showError(data.message);
    } catch (err: any) {
        showError(err.message);
    } finally {
        setIsValidating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copiado!");
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const toggleEndpoint = (id: string) => {
    setOpenEndpoints(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bitcoin className="h-8 w-8 text-orange-500" />
            Gestão Web3 (Cripto)
            </h1>
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold">
                USDT / BSC
            </Badge>
        </div>
        <p className="text-muted-foreground">
          Gerencie pagamentos descentralizados, valide transações e conecte seu N8N.
        </p>
      </div>

      <Tabs defaultValue="orders" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] bg-slate-100 p-1">
            <TabsTrigger value="orders" className="font-bold">Pedidos Cripto</TabsTrigger>
            <TabsTrigger value="settings" className="font-bold">Carteira & Config</TabsTrigger>
            <TabsTrigger value="api" className="font-bold">API & N8N</TabsTrigger>
        </TabsList>

        {/* ABA 1: PEDIDOS CRIPTO */}
        <TabsContent value="orders" className="mt-6 space-y-4">
            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50 border-b pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-orange-600" /> Vendas via USDT/Cripto
                    </CardTitle>
                    <CardDescription>Estes pedidos também aparecem na lista geral, mas aqui você foca na validação dos Hashes.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-b-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pedido</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Hash (TxID)</TableHead>
                                    <TableHead>Rede</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingOrders ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                                ) : cryptoOrders && cryptoOrders.length > 0 ? (
                                    cryptoOrders.map((order: any) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono font-bold">#{order.id}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{order.profiles?.first_name} {order.profiles?.last_name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-green-700">
                                                {formatCurrency(order.total_price)}
                                            </TableCell>
                                            <TableCell>
                                                {order.crypto_hash ? (
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={`https://bscscan.com/tx/${order.crypto_hash}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline font-mono text-xs max-w-[100px] truncate block"
                                                            title={order.crypto_hash}
                                                        >
                                                            {order.crypto_hash}
                                                        </a>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(order.crypto_hash)}>
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">Aguardando hash...</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">
                                                    {order.crypto_network || 'BSC'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    order.status === 'Pago' || order.status === 'Finalizada' 
                                                        ? "bg-green-500 hover:bg-green-600" 
                                                        : "bg-yellow-500 hover:bg-yellow-600"
                                                )}>
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {order.crypto_hash && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="secondary" 
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            setTestHash(order.crypto_hash);
                                                            setActiveTab("settings");
                                                            handleValidateHash(order.crypto_hash);
                                                        }}
                                                    >
                                                        Revalidar
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum pedido cripto encontrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* ABA 2: CONFIGURAÇÕES E TESTE */}
        <TabsContent value="settings" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Sua Carteira (Recebimento)</CardTitle>
                                    <CardDescription>O dinheiro cai aqui (Self-Custody). Sem intermediários.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Ativar no Site</Label>
                                    <Switch 
                                        checked={isEnabled} 
                                        onCheckedChange={setIsEnabled} 
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Endereço Público (BSC / BEP-20)</Label>
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
                                    Certifique-se de que esta carteira aceita tokens <strong>USDT na rede Binance Smart Chain (BEP-20)</strong>.
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
                                <Search className="w-4 h-4" /> Validador de Transação (Manual)
                            </CardTitle>
                            <CardDescription>Cole um Hash para simular o que o sistema fará automaticamente.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Cole o Hash (TxID) aqui... ex: 0x123abc..." 
                                    className="font-mono text-xs bg-white"
                                    value={testHash}
                                    onChange={(e) => setTestHash(e.target.value)}
                                />
                                <Button onClick={() => handleValidateHash()} disabled={isValidating || !testHash} className="bg-blue-600 hover:bg-blue-700">
                                    {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
                                </Button>
                            </div>

                            {validationResult && (
                                <div className={cn("p-4 rounded-lg border bg-white animate-in fade-in slide-in-from-top-2", validationResult.valid ? "border-green-200" : "border-red-200")}>
                                    <div className={cn("flex items-center gap-2 font-bold mb-2", validationResult.valid ? "text-green-700" : "text-red-700")}>
                                        {validationResult.valid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                        {validationResult.message}
                                    </div>
                                    {validationResult.details && (
                                        <div className="text-xs font-mono space-y-1 opacity-80 p-2 bg-slate-50 rounded border">
                                            <p><span className="font-bold">Pagador:</span> {validationResult.details.from}</p>
                                            <p><span className="font-bold">Valor Detectado:</span> {validationResult.amount} USDT</p>
                                            <p><span className="font-bold">Bloco:</span> {validationResult.block}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-gradient-to-br from-gray-900 to-slate-800 text-white border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-400">
                                <ShieldCheck className="w-5 h-5" /> Segurança
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <p className="text-gray-300">O sistema lê diretamente a Blockchain (RPC Pública) para confirmar se o dinheiro entrou.</p>
                            <div className="p-3 bg-white/10 rounded-lg">
                                <p className="font-bold text-orange-300 mb-1">Contrato USDT Monitorado:</p>
                                <p className="font-mono text-[10px] break-all">0x55d398326f99059fF775485246999027B3197955</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>

        {/* ABA 3: API & N8N (ATUALIZADA) */}
        <TabsContent value="api" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Workflow className="w-5 h-5 text-purple-600" /> Integração N8N / Typebot</CardTitle>
                    <CardDescription>Documentação técnica para configurar o robô de validação automática.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-sm font-black uppercase text-emerald-600 mb-3 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4" /> API (Recebimento do N8N)</h3>
                        <div className="space-y-3">
                            {cryptoEndpoints.map((api) => (
                                <Collapsible key={api.id} open={openEndpoints.includes(api.id)} onOpenChange={() => toggleEndpoint(api.id)} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden" onClick={() => toggleEndpoint(api.id)}>
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 w-24 justify-center">{api.method}</Badge>
                                            <span className="font-mono text-xs font-bold text-slate-700 truncate">{api.path}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div onClick={() => toggleEndpoint(api.id)} className="cursor-pointer">
                                                {openEndpoints.includes(api.id) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                                            </div>
                                        </div>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="p-4 bg-slate-50 border-t space-y-4">
                                            <div className="flex items-center gap-2 bg-white border p-2 rounded"><span className="text-xs font-mono text-gray-600 select-all flex-1">{API_URL}{api.path.split('?')[0]}</span><Button variant="ghost" size="sm" className="h-6" onClick={() => copyToClipboard(API_URL + api.path.split('?')[0])}><Copy className="w-3 h-3" /></Button></div>
                                            <p className="text-xs text-gray-500 font-medium mt-2">{api.desc}</p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-xs mb-1 block font-bold text-gray-500">Corpo da Requisição (Body)</Label>
                                                    <div className="bg-slate-900 text-yellow-300 p-3 rounded-md font-mono text-xs overflow-x-auto h-32 border border-slate-700"><pre>{api.body}</pre></div>
                                                </div>
                                                <div>
                                                    <Label className="text-xs mb-1 block font-bold text-gray-500">Exemplo de Resposta</Label>
                                                    <div className="bg-slate-900 text-green-300 p-3 rounded-md font-mono text-xs overflow-x-auto h-32 border border-slate-700"><pre>{api.response}</pre></div>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
                        <p className="font-bold flex items-center gap-2 mb-1"><Zap className="w-4 h-4" /> Dica de Fluxo N8N:</p>
                        <p>1. O cliente escolhe "Cripto" no site.</p>
                        <p>2. O N8N manda mensagem: "Envie o Hash da transação".</p>
                        <p>3. O cliente manda o Hash.</p>
                        <p>4. O N8N chama este endpoint (<code>/verify-blockchain-tx</code>).</p>
                        <p>5. Se a resposta for <code>valid: true</code>, o pedido já é marcado como Pago automaticamente.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CryptoPage;
// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Node Público da Binance Smart Chain (BSC)
const RPC_URL = "https://bsc-dataseed.binance.org/";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { tx_hash, wallet_address, expected_amount_brl } = await req.json();

    if (!tx_hash || !wallet_address) {
        throw new Error("Hash e Carteira são obrigatórios.");
    }

    // 1. Consulta a transação na Blockchain
    const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionByHash",
            params: [tx_hash],
            id: 1
        })
    });

    const rpcData = await response.json();
    const tx = rpcData.result;

    if (!tx) {
        return new Response(JSON.stringify({ valid: false, message: "Transação não encontrada na Blockchain." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Validações de Segurança
    
    // A. Verifica o Destinatário (Case Insensitive)
    if (tx.to.toLowerCase() !== wallet_address.toLowerCase()) {
        return new Response(JSON.stringify({ valid: false, message: "O destinatário dessa transação não é a sua carteira." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // B. Verifica o status (Precisa consultar o Recibo)
    const receiptResponse = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionReceipt",
            params: [tx_hash],
            id: 1
        })
    });
    const receiptData = await receiptResponse.json();
    
    // status '0x1' significa sucesso na EVM
    if (!receiptData.result || receiptData.result.status !== '0x1') {
        return new Response(JSON.stringify({ valid: false, message: "A transação falhou ou ainda está pendente." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // C. Conversão de Valores (Wei -> BNB -> BRL aproximado)
    // Nota: Aqui assumimos pagamento nativo (BNB). Para USDT precisaríamos decodificar o 'Input Data'.
    // Para simplificar, neste MVP, apenas validamos que a transação existe e foi para a carteira certa.
    const valueInWei = parseInt(tx.value, 16);
    const valueInEth = valueInWei / 10**18;

    return new Response(
      JSON.stringify({ 
          valid: true, 
          message: "Transação Válida!",
          details: {
              from: tx.from,
              value_native: valueInEth,
              block: parseInt(tx.blockNumber, 16)
          }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
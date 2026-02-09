// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Node Público da Binance Smart Chain (BSC)
const RPC_URL = "https://bsc-dataseed.binance.org/";

// Contrato Oficial do USDT na BSC (BEP-20)
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

// Assinatura do evento Transfer(address,address,uint256) (Padrão ERC-20)
// Keccak-256 de "Transfer(address,address,uint256)"
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { tx_hash, wallet_address, order_id } = await req.json();

    if (!tx_hash || !wallet_address) {
        throw new Error("Hash e Carteira são obrigatórios.");
    }

    // Normaliza para lowercase para comparação
    const targetWallet = wallet_address.toLowerCase();
    const targetHash = tx_hash.trim();

    // 1. Consulta o Recibo da Transação (Contém os Logs de Eventos)
    const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getTransactionReceipt",
            params: [targetHash],
            id: 1
        })
    });

    const rpcData = await response.json();
    const receipt = rpcData.result;

    if (!receipt) {
        return new Response(JSON.stringify({ 
            valid: false, 
            message: "Transação não encontrada ou ainda não propagada na Blockchain." 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Verifica status de sucesso (0x1)
    if (receipt.status !== '0x1') {
        return new Response(JSON.stringify({ 
            valid: false, 
            message: "A transação falhou na Blockchain (Status: Falha)." 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Análise de Tokens (USDT) - Lendo os Logs
    let usdtValueFound = 0;
    let senderAddress = receipt.from;

    for (const log of receipt.logs) {
        // Verifica se o log vem do contrato do USDT
        if (log.address.toLowerCase() === USDT_CONTRACT.toLowerCase()) {
            
            // Verifica se é um evento de Transferência
            const topic0 = log.topics[0];
            if (topic0 === TRANSFER_EVENT_TOPIC) {
                
                // Topics[1] = From (com padding de 0000)
                // Topics[2] = To (com padding de 0000)
                const toAddressHex = log.topics[2];
                
                // Remove os zeros à esquerda do padding (últimos 40 caracteres são o endereço)
                const toAddressClean = "0x" + toAddressHex.slice(-40);

                // Verifica se o dinheiro foi para a NOSSA carteira
                if (toAddressClean.toLowerCase() === targetWallet) {
                    // O valor está em 'data' (Hexadecimal)
                    const valueHex = log.data;
                    const valueWei = parseInt(valueHex, 16);
                    
                    // USDT na BSC tem 18 casas decimais
                    const valueToken = valueWei / 10**18;
                    
                    usdtValueFound += valueToken;
                }
            }
        }
    }

    // 3. Verificação de BNB Nativo (Caso o cliente mande BNB por engano, ainda validamos)
    let bnbValueFound = 0;
    // Precisaríamos buscar 'eth_getTransactionByHash' para ver valor nativo, 
    // mas focaremos no USDT conforme solicitado. Se quiser híbrido, podemos adicionar.

    if (usdtValueFound > 0) {
        
        // --- SUCESSO: ATUALIZAÇÃO AUTOMÁTICA DO PEDIDO ---
        // Se um order_id foi passado, já atualizamos o banco para "Pago"
        if (order_id) {
            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
                { auth: { persistSession: false } }
            );

            // Verifica se o hash já foi usado (Segurança Anti-Duplo Gasto)
            const { data: existingOrder } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('crypto_hash', targetHash)
                .neq('id', order_id) // Ignora se for o mesmo pedido (retry)
                .maybeSingle();

            if (existingOrder) {
                 return new Response(JSON.stringify({ 
                    valid: false, 
                    message: `Hash já utilizado no pedido #${existingOrder.id}.` 
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }

            // Atualiza o pedido
            await supabaseAdmin
                .from('orders')
                .update({
                    status: 'Pago',
                    payment_method: 'USDT (Crypto)',
                    crypto_hash: targetHash,
                    crypto_network: 'BSC',
                    delivery_status: 'Pendente' // Reseta para pendente de envio se estava aguardando
                })
                .eq('id', order_id);
        }

        return new Response(
            JSON.stringify({ 
                valid: true, 
                currency: 'USDT',
                amount: usdtValueFound,
                message: `Pagamento de ${usdtValueFound} USDT confirmado!`,
                block: parseInt(receipt.blockNumber, 16)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } 
    
    // Se chegou aqui, a transação existe mas não transferiu USDT para a carteira alvo
    return new Response(JSON.stringify({ 
        valid: false, 
        message: "Transação encontrada, mas não identificamos transferência de USDT para sua carteira." 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
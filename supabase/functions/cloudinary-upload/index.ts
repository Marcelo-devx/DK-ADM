// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert ArrayBuffer to hex string (for SHA-1 signature)
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[cloudinary-upload] Iniciando requisição de upload');

    const body = await req.json();
    const { image } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'Nenhum dado de arquivo fornecido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[cloudinary-upload] Variáveis de ambiente do Cloudinary ausentes');
      return new Response(
        JSON.stringify({ error: 'Credenciais do Cloudinary não configuradas. Verifique CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET nos secrets da Edge Function.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[cloudinary-upload] Credenciais encontradas, preparando upload para cloud:', cloudName);

    const folder = 'tabacaria-products';
    const timestamp = Math.floor(Date.now() / 1000);

    // Gerar assinatura SHA-1 para upload autenticado
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const toSign = paramsToSign + apiSecret;
    const sigBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
    const signature = toHex(sigBuffer);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const formData = new FormData();
    formData.append('file', image);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('resource_type', 'auto');

    console.log('[cloudinary-upload] Enviando para Cloudinary:', uploadUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('[cloudinary-upload] Status da resposta Cloudinary:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[cloudinary-upload] Erro do Cloudinary:', response.status, errorText);
      throw new Error(`Cloudinary retornou erro ${response.status}: ${errorText}`);
    }

    const uploadResult = await response.json();

    if (!uploadResult?.secure_url) {
      throw new Error('Cloudinary não retornou uma URL segura na resposta.');
    }

    console.log('[cloudinary-upload] Upload concluído com sucesso:', uploadResult.public_id);

    return new Response(
      JSON.stringify({ secure_url: uploadResult.secure_url, public_id: uploadResult.public_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[cloudinary-upload] Erro:', error?.message || error);
    return new Response(
      JSON.stringify({ error: 'Falha ao processar o upload.', details: error?.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})

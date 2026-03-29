// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to convert ArrayBuffer to hex
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[cloudinary-upload] Iniciando requisição de upload');

    const { image } = await req.json();

    if (!image) {
      throw new Error("Nenhum dado de arquivo fornecido no corpo da requisição.");
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[cloudinary-upload] Variáveis de ambiente ausentes');
      throw new Error("Credenciais do Cloudinary não configuradas.");
    }

    console.log('[cloudinary-upload] Preparando upload para Cloudinary:', { cloudName });

    // Use signed upload: compute timestamp and signature per Cloudinary API
    const folder = 'tabacaria-products';
    const timestamp = Math.floor(Date.now() / 1000);

    // Build the string to sign - order of params matters and must not include empty values
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const toSign = paramsToSign + apiSecret;

    // Compute sha1 signature
    const sigBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
    const signature = toHex(sigBuffer);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const formData = new FormData();
    // Cloudinary accepts both data URLs and binary file - we send the data URL as-is
    formData.append('file', image);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('resource_type', 'auto');

    console.log('[cloudinary-upload] Enviando requisição para:', uploadUrl, { folder, timestamp });

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('[cloudinary-upload] Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[cloudinary-upload] Erro na resposta do Cloudinary:', response.status, errorText);
      throw new Error(`Erro no Cloudinary: ${response.status} - ${errorText}`);
    }

    const uploadResult = await response.json();

    console.log('[cloudinary-upload] Upload realizado com sucesso:', {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url
    });

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error("A resposta do Cloudinary não continha uma URL segura.");
    }

    return new Response(
      JSON.stringify({ secure_url: uploadResult.secure_url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[cloudinary-upload] Erro detalhado:', error);
    return new Response(
      JSON.stringify({
        error: 'Falha ao processar o upload.',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
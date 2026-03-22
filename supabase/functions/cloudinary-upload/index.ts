// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Criar FormData manualmente para upload
    const formData = new FormData();
    formData.append('file', image);
    formData.append('folder', 'tabacaria-products');
    formData.append('resource_type', 'auto'); // Detecta automaticamente se é imagem ou vídeo

    // Usar Basic Auth para autenticação (mais leve que assinatura completa)
    const authHeader = btoa(`${apiKey}:${apiSecret}`);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    console.log('[cloudinary-upload] Enviando requisição para:', uploadUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
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

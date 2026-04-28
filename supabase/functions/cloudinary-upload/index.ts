// @ts-nocheck
// v4 - envia base64 diretamente para o Cloudinary (suportado nativamente)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET simples para keep-alive / health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', function: 'cloudinary-upload' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('[cloudinary-upload] Requisição recebida, método:', req.method);

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error('[cloudinary-upload] Erro ao parsear body JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Body inválido. Esperado JSON.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { image } = body;

    if (!image) {
      console.error('[cloudinary-upload] Nenhum dado de imagem fornecido');
      return new Response(
        JSON.stringify({ error: 'Nenhum dado de arquivo fornecido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[cloudinary-upload] Credenciais do Cloudinary ausentes');
      return new Response(
        JSON.stringify({ error: 'Credenciais do Cloudinary não configuradas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[cloudinary-upload] Credenciais OK, cloud:', cloudName);
    console.log('[cloudinary-upload] Tamanho da imagem (chars):', image.length);

    const folder = 'tabacaria-products';
    const timestamp = Math.floor(Date.now() / 1000);

    // Assinar os parâmetros
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const toSign = paramsToSign + apiSecret;
    const sigBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign));
    const signature = toHex(sigBuffer);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    // Cloudinary aceita base64 data URI diretamente no campo "file"
    const formData = new FormData();
    formData.append('file', image); // data:image/jpeg;base64,... ou data:image/png;base64,...
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);

    console.log('[cloudinary-upload] Enviando para Cloudinary:', uploadUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('[cloudinary-upload] Status Cloudinary:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[cloudinary-upload] Erro Cloudinary:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Cloudinary retornou erro ${response.status}`, details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const uploadResult = await response.json();

    if (!uploadResult?.secure_url) {
      console.error('[cloudinary-upload] Resposta sem secure_url:', JSON.stringify(uploadResult));
      return new Response(
        JSON.stringify({ error: 'Cloudinary não retornou uma URL válida.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    console.log('[cloudinary-upload] Upload concluído:', uploadResult.public_id);

    return new Response(
      JSON.stringify({ secure_url: uploadResult.secure_url, public_id: uploadResult.public_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[cloudinary-upload] Erro inesperado:', error?.message || String(error));
    return new Response(
      JSON.stringify({ error: 'Falha ao processar o upload.', details: error?.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

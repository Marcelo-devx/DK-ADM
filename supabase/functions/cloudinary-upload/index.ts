// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { v2 as cloudinary } from 'npm:cloudinary@^2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configure Cloudinary using secrets
cloudinary.config({
  cloud_name: Deno.env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: Deno.env.get('CLOUDINARY_API_KEY'),
  api_secret: Deno.env.get('CLOUDINARY_API_SECRET'),
  secure: true,
});

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image } = await req.json();

    if (!image) {
      throw new Error("Nenhum dado de arquivo fornecido no corpo da requisição.");
    }

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: "tabacaria-products", // Organiza os uploads em uma pasta
      resource_type: "auto", // Detecta se é imagem ou vídeo
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
    console.error('Erro detalhado no upload para o Cloudinary:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Falha ao processar o upload.',
        details: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Usando 500 para erro interno do servidor
      }
    )
  }
})
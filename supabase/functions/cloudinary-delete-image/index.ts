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
    const { public_id } = await req.json();

    if (!public_id) {
      throw new Error("O public_id da imagem é obrigatório.");
    }

    // Use uploader.destroy para remover a imagem
    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result !== 'ok') {
        throw new Error(result.result);
    }

    return new Response(
      JSON.stringify({ message: "Imagem removida com sucesso." }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error deleting Cloudinary resource:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao remover o recurso do Cloudinary.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
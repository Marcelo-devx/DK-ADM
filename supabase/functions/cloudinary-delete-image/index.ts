// @ts-nocheck
// v2 - force redeploy
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { v2 as cloudinary } from 'npm:cloudinary@^2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.error('[cloudinary-delete-image] Cloudinary env vars missing or empty');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET simples para keep-alive / health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', function: 'cloudinary-delete-image' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error('[cloudinary-delete-image] Variáveis de ambiente do Cloudinary ausentes');
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured in Edge Function (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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
// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { v2 as cloudinary } from 'npm:cloudinary@^2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Read secrets (at runtime)
const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');

// Configure Cloudinary using secrets if present
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.error('[cloudinary-usage] Cloudinary env vars missing or empty');
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // If secrets are missing, return a clear error so the client sees why the request failed
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error('[cloudinary-usage] Variáveis de ambiente do Cloudinary ausentes');
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured in Edge Function (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Fetch usage details from Cloudinary
    const usageData = await cloudinary.api.usage();

    const result = {
      storage: usageData.storage,
      resources: usageData.resources,
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error fetching Cloudinary usage:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Cloudinary usage data.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
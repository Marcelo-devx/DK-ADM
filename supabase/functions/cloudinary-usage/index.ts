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
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
    // Fetch resources from Cloudinary, sorted by creation date
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 50, // Limit results for performance
      direction: 'desc' // Sort by date descending
    });

    return new Response(
      JSON.stringify(result.resources),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error fetching Cloudinary resources:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Cloudinary resources.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
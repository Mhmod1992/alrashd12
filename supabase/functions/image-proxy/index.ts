
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Declare Deno to fix "Cannot find name 'Deno'" error in Supabase Edge Function.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      throw new Error('imageUrl is required');
    }

    // Security: Basic validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!imageUrl.startsWith(supabaseUrl)) {
        const allowedDomains = ['i.ibb.co', 'upload.wikimedia.org'];
        const url = new URL(imageUrl);
        if (!allowedDomains.includes(url.hostname)) {
             throw new Error('Provided URL is not from a trusted source.');
        }
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const base64String = `data:${contentType};base64,${base64}`;

    return new Response(JSON.stringify({ base64: base64String }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Image proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

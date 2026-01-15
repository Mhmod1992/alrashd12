
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Declare Deno to fix "Cannot find name 'Deno'" error in Supabase Edge Function.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { email, password } = await req.json(); 

    if (!email || !password) {
      throw new Error("Email and Password are required.");
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase environment variables in Edge Function.');
      throw new Error('Server configuration error.');
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { persistSession: false } }
    );

    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .ilike('email', email)
      .single();

    if (error || !employee) {
      console.error('Login error: employee not found or db error', error);
      throw new Error('Invalid credentials');
    }

    if (employee.password !== password) {
      throw new Error('Invalid credentials');
    }

    if (!employee.is_active) {
      throw new Error('User account is not active');
    }

    // Don't send the password back to the client
    delete employee.password;

    return new Response(JSON.stringify({ employee }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401, // Unauthorized
    });
  }
});

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // 1. Authorization Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error('Server configuration error.');
    }

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'general_manager') {
      throw new Error('Unauthorized: General Manager privileges required.');
    }

    // 2. Perform Operation
    const { userId, newPassword } = await req.json();
    
    if (!userId || !newPassword) {
      throw new Error("User ID and new password are required.");
    }
     if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error('Error updating user:', error);
      throw error;
    }

    return new Response(JSON.stringify({ message: "Password updated successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const status = error.message.includes('Unauthorized') ? 403 : 400;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});

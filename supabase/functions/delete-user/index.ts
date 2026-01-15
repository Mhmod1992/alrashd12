
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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("User ID is required.");
    }

    if (userId === user.id) {
        throw new Error("Cannot delete your own account.");
    }

    // --- FIX: Delete from public.employees table FIRST ---
    const { error: dbError } = await supabaseAdmin
        .from('employees')
        .delete()
        .eq('id', userId);

    if (dbError) {
        console.error('Error deleting from employees table:', dbError);
        throw new Error(`Failed to delete employee profile: ${dbError.message}`);
    }

    // Now, delete the user from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('CRITICAL: Deleted employee profile but failed to delete auth user:', authDeleteError);
      throw new Error(`The employee profile was deleted, but the authentication account could not be removed. Error: ${authDeleteError.message}`);
    }

    return new Response(JSON.stringify({ message: "User deleted successfully" }), {
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

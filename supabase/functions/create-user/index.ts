
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: { env: { get(key: string): string | undefined; }; };

async function getAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string): Promise<{ id: string } | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
    });

    const { data: { user } } = await authClient.auth.getUser();
    return user;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders, status: 204 });
    }

    let supabaseAdmin: SupabaseClient | undefined;
    let newAuthUserId: string | undefined;

    try {
        // --- Setup ---
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !serviceKey || !anonKey) {
            throw new Error('خطأ في إعدادات الخادم: متغيرات Supabase الأساسية غير موجودة.');
        }

        supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false }
        });

        // --- Authorization ---
        const user = await getAuthenticatedUser(req, supabaseUrl, anonKey);
        if (!user) {
            throw new Error('خطأ في المصادقة: لم يتم العثور على رمز الدخول أو أنه غير صالح.');
        }

        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('employees')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !callerProfile || callerProfile.role !== 'general_manager') {
            throw new Error('غير مصرح به: هذه العملية تتطلب صلاحيات مدير عام.');
        }

        // --- Body Parsing & Validation ---
        // 'preferences' might contain isTechnician. 'is_technician' might be passed separately but we want to store it in preferences.
        const { name, email, password, role, permissions, salary, preferences } = await req.json();
        
        if (!email || !name || !role) {
            throw new Error("بيانات ناقصة: البريد الإلكتروني، الاسم، والدور الوظيفي مطلوبة.");
        }
        if (password && password.length < 6) {
            throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        }

        // --- Core Logic ---
        // 1. Create Auth User
        const finalPassword = password || Math.random().toString(36).slice(-8);
        const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: finalPassword,
            email_confirm: false, // Create user as confirmed
        });
        
        if (createAuthError) {
            throw new Error(createAuthError.message.includes('already registered')
                ? 'هذا البريد الإلكتروني مسجل بالفعل.'
                : `فشل إنشاء حساب المصادقة: ${createAuthError.message}`
            );
        }
        newAuthUserId = authData.user.id;

        // 2. Create Employee Profile
        // Ensure preferences is an object if not provided
        const finalPreferences = preferences || {};
        
        const { error: createProfileError } = await supabaseAdmin.from('employees').insert({
            id: newAuthUserId,
            name,
            email,
            role,
            permissions: permissions || [],
            is_active: true,
            salary: salary || 0,
            preferences: finalPreferences // Store as JSON
        });

        if (createProfileError) {
            // This will trigger the rollback in the catch block
            throw new Error(`فشل إنشاء ملف الموظف: ${createProfileError.message}`);
        }

        // --- Success Response ---
        const employee = {
            id: newAuthUserId,
            name, email, role,
            permissions: permissions || [],
            is_active: true,
            salary: salary || 0,
            preferences: finalPreferences,
            password: finalPassword, // Important: Send back the generated password
        };

        return new Response(JSON.stringify({ employee }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Error in create-user function:", error.message);

        // --- Rollback Logic ---
        if (newAuthUserId && supabaseAdmin) {
            console.log(`Attempting to roll back auth user creation for ID: ${newAuthUserId}`);
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
            if (deleteError) {
                // Log this critical failure, but don't re-throw, to ensure the original error is sent to client
                console.error("CRITICAL: User creation rollback failed:", deleteError.message);
            } else {
                console.log("Rollback successful.");
            }
        }
        
        const status = error.message.includes('Unauthorized') ? 403 : 400;
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status,
        });
    }
});

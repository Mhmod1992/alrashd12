
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration for Supabase connection
// Using the keys provided for the specific project instance
export const supabaseUrl = 'https://pmdyrqkfmymwskavegat.supabase.co';
export const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHlycWtmbXltd3NrYXZlZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzA0OTQsImV4cCI6MjA3OTYwNjQ5NH0.qyMANWHQ29TSkOAHId4Maa-yZptLD6l8n2X0vlDN_TE';

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase URL or Key.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: window.localStorage, // Explicitly use localStorage for persistence
    autoRefreshToken: true, // Ensure token refreshes automatically
    persistSession: true, // Persist session across tabs/reloads
    detectSessionInUrl: true,
  },
});

// Helper to create a temporary client for admin actions (like creating a new user)
// without logging out the current admin session.
export const createTemporaryClient = (): SupabaseClient => {
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false, // Don't overwrite admin session in local storage
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
};

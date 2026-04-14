import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pmdyrqkfmymwskavegat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHlycWtmbXltd3NrYXZlZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzA0OTQsImV4cCI6MjA3OTYwNjQ5NH0.qyMANWHQ29TSkOAHId4Maa-yZptLD6l8n2X0vlDN_TE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase.from('app_settings').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Settings Rows:', JSON.stringify(data, null, 2));
    }
}

checkSettings();

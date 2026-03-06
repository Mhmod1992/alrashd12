import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://pmdyrqkfmymwskavegat.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHlycWtmbXltd3NrYXZlZ2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzA0OTQsImV4cCI6MjA3OTYwNjQ5NH0.qyMANWHQ29TSkOAHId4Maa-yZptLD6l8n2X0vlDN_TE';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
  const { data, error } = await supabase.from('clients').select('*, inspection_requests(count)').limit(1);
  console.log(JSON.stringify({data, error}, null, 2));
}
run();

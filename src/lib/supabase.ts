import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// A anon key é segura pra expor no client — o que protege os dados é a
// Row Level Security da tabela (só permite INSERT público, nunca leitura).
// Ver supabase/schema.sql.
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// A anon key é segura pra expor no client — o que protege os dados é a
// Row Level Security da tabela (só permite INSERT público, nunca leitura).
// Ver supabase/schema.sql.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

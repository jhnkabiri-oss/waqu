import { createClient } from '@supabase/supabase-js';

// Note: This client should ONLY be used in server-side contexts where security is guaranteed.
// It uses the Service Role Key to bypass Row Level Security.

let adminClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
    if (adminClient) return adminClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase URL or Service Role Key');
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return adminClient;
};

// Backwards compatibility for now, but safer to use function
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
    get: (_target, prop) => {
        const client = getSupabaseAdmin();
        return (client as any)[prop];
    }
});

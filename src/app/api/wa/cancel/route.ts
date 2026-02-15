import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { profileId = '1' } = body;

        const client = waManager.getClient(user.id, profileId);
        if (client) {
            await client.cancelConnection();
        }

        return NextResponse.json({ message: `Profile ${profileId} connection cancelled` });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to cancel: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

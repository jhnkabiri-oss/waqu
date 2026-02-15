import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For specific profile query
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (profileId) {
        // Return single profile status
        const client = waManager.getClient(user.id, profileId);
        return NextResponse.json(
            client?.getStatus() ?? {
                userId: user.id,
                profileId,
                status: 'disconnected',
                qr: null,
                pairingCode: null,
                phoneNumber: null
            }
        );
    }

    // Return all profiles for this user
    return NextResponse.json({ profiles: waManager.getUserStatuses(user.id) });
}

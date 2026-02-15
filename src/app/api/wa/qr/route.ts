import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
        return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
    }

    const client = waManager.getClient(user.id, profileId);
    if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const status = client.getStatus();
    return NextResponse.json({ qr: status.qr });
}

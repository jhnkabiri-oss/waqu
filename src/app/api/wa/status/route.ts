import { NextRequest, NextResponse } from 'next/server';
import { waManager, WAClient } from '@/lib/wa-client';
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
    const profiles = waManager.getUserStatuses(user.id);

    // AUTO-WAKE: If Default Profile 1 is disconnected (meaning likely not in memory due to server restart),
    // trigger a connection attempt so it restores from Redis or File Store.
    const p1 = profiles.find(p => p.profileId === '1');
    if (p1 && p1.status === 'disconnected') {

        // CHECK SESSION EXISTENCE FIRST (File or Redis)
        // Only if a session actually exists do we attempt to create the client and connect.
        const sessionExists = await WAClient.sessionExists(user.id, '1');

        if (sessionExists) {
            const client = waManager.getOrCreateClient(user.id, '1');

            if (client.connectionStatus === 'disconnected') {
                console.log(`[API-Status] Auto-waking up Profile 1 for user ${user.id} (Session found)`);
                client.connect().catch(e => console.error(`[API-Status] Auto-wake failed:`, e));
                // Show connecting immediately to user
                p1.status = 'connecting';
            } else {
                p1.status = client.connectionStatus;
            }
        } else {
            // No session, so it's truly disconnected/brand new. Do nothing.
        }
    }

    return NextResponse.json({ profiles });
}

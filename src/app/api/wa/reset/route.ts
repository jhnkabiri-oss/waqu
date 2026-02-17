import { NextRequest, NextResponse } from 'next/server';
import { waManager } from '@/lib/wa-client';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clearRedisAuthState } from '@/lib/baileys-redis-auth';

export async function DELETE(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get('profileId') || '1';

        console.log(`[API-Reset] Hard resetting session for user ${user.id} profile ${profileId}`);

        // 1. Disconnect and remove from memory
        await waManager.removeClient(user.id, profileId);

        // 2. Clear File Store (if exists)
        try {
            const fs = await import('fs/promises');
            await fs.rm(`sessions/${user.id}-${profileId}`, { recursive: true, force: true });
            console.log(`[API-Reset] Deleted file session: sessions/${user.id}-${profileId}`);
        } catch (e) {
            console.warn(`[API-Reset] File session deletion error (might not exist):`, e);
        }

        // 3. Clear Redis Store (just in case)
        try {
            const sessionPrefix = `wa:sess:${user.id}:profile-${profileId}:`;
            await clearRedisAuthState(sessionPrefix);
            console.log(`[API-Reset] Cleared Redis session: ${sessionPrefix}`);
        } catch (e) {
            console.warn(`[API-Reset] Redis session deletion error:`, e);
        }

        return NextResponse.json({ success: true, message: 'Session hard reset complete' });
    } catch (error) {
        console.error('[API-Reset] Error:', error);
        return NextResponse.json(
            { error: 'Failed to reset session: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

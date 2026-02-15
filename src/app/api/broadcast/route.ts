import { NextRequest, NextResponse } from 'next/server';
import { broadcastQueue } from '@/lib/queue';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { recipients, message, minDelay = 10, maxDelay = 30, profileId } = await req.json();

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json(
                { error: 'No recipients specified' },
                { status: 400 }
            );
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        const jobId = `broadcast_${user.id}_${Date.now()}`;
        const job = await broadcastQueue.add('send-broadcast', {
            jobId,
            userId: user.id,
            profileId,
            recipients: recipients.map((r: string) => {
                const clean = r.replace(/[^0-9@.]/g, '');
                if (clean.includes('@')) return clean;
                return `${clean}@s.whatsapp.net`;
            }),
            message: message.trim(),
            minDelay: Math.max(5, minDelay),
            maxDelay: Math.max(minDelay + 5, maxDelay),
            totalRecipients: recipients.length,
        });

        return NextResponse.json({
            message: `Broadcast queued for ${recipients.length} recipients`,
            jobId: job.id,
            broadcastId: jobId,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to queue broadcast: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

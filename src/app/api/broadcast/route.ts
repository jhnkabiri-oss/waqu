import { NextRequest, NextResponse } from 'next/server';
import { broadcastQueue } from '@/lib/queue-supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const json = await req.json();
        const { recipients, message, minDelay = 10, maxDelay = 30, profileId } = json;

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

        // Add job to Supabase queue
        const job = await broadcastQueue.add('send-broadcast', {
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
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to queue broadcast: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

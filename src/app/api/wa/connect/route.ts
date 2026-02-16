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

    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get('profileId');

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        const client = waManager.getClient(user.id, profileId);

        if (!client) {
            return NextResponse.json({ message: 'Client not found or not initialized' });
        }

        const status = client.getStatus();

        return NextResponse.json({
            isConnected: client.isConnected(),
            isConnecting: status.status === 'connecting',
            qr: status.qr,
            pairingCode: status.pairingCode,
            status: status,
        });
    } catch (error) {
        console.error('Get client status error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { profileId, phoneNumber } = body;

        if (!profileId) {
            return NextResponse.json({ error: 'Profile ID Required' }, { status: 400 });
        }

        const client = waManager.getOrCreateClient(user.id, profileId);

        if (client.isConnected()) {
            return NextResponse.json({ message: 'Already connected' });
        }

        // If phone number provided, use Pairing Code
        if (phoneNumber) {
            try {
                const code = await client.connectWithCode(phoneNumber);
                return NextResponse.json({ code });
            } catch (error) {
                return NextResponse.json({ error: (error as Error).message }, { status: 500 });
            }
        }

        // Otherwise use QR
        client.connect();
        return NextResponse.json({ message: 'Connecting...' });

    } catch (error) {
        console.error('Connect error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

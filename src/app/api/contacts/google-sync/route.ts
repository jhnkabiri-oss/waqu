import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl, getTokensFromCode, getPeopleService } from '@/lib/google';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
        // Step 1: Return auth URL
        const authUrl = getAuthUrl();
        return NextResponse.json({ authUrl });
    }

    // Step 2: Exchange code for tokens
    try {
        const { tokens } = await getTokensFromCode(code);
        return NextResponse.json({ tokens, message: 'Google account connected!' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to get tokens: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { accessToken, contacts } = await req.json();

        if (!accessToken) {
            return NextResponse.json({ error: 'No access token' }, { status: 400 });
        }

        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return NextResponse.json({ error: 'No contacts to sync' }, { status: 400 });
        }

        const peopleService = getPeopleService(accessToken);
        const results = [];

        for (const contact of contacts) {
            try {
                await peopleService.people.createContact({
                    requestBody: {
                        names: [{ givenName: contact.name }],
                        phoneNumbers: [{ value: contact.phone }],
                    },
                });
                results.push({ name: contact.name, status: 'synced' });
            } catch (err) {
                results.push({
                    name: contact.name,
                    status: 'failed',
                    error: (err as Error).message,
                });
            }
        }

        return NextResponse.json({
            message: `Synced ${results.filter((r) => r.status === 'synced').length}/${contacts.length} contacts`,
            results,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Sync failed: ' + (error as Error).message },
            { status: 500 }
        );
    }
}

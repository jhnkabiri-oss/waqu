import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        const secret = process.env.AUTH_SECRET;

        // Simple validation
        if (!token || token !== secret) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Create response and set cookie
        const response = NextResponse.json({ success: true });

        // Set HTTP-only cookie
        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        return response;
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

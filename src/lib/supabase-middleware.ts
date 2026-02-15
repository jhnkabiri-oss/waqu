import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // refresh session if expired
    const { data: { user } } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname;

    // Public paths
    if (
        path.startsWith('/_next') ||
        path.startsWith('/static') ||
        path.includes('.') ||
        path === '/login' ||
        path.startsWith('/auth') || // e.g. /auth/confirm
        path.startsWith('/api/auth') // e.g. /api/auth/callback
    ) {
        return response;
    }

    // Protected paths
    if (!user) {
        // If it's an API route, return 401 JSON
        if (path.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Otherwise redirect to login
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return response
}

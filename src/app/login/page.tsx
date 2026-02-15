'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Turnstile } from '@marsidev/react-turnstile';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createSupabaseBrowserClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // if (!captchaToken) {
        //     setError('Please complete the CAPTCHA');
        //     setLoading(false);
        //     return;
        // }

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
                // options: { captchaToken },
            });

            if (signInError) {
                setError(signInError.message);
                // Reset captcha on error
                setCaptchaToken('');
            } else {
                router.push('/');
                router.refresh();
            }
        } catch (err) {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: '20px',
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Sign in to manage your WhatsApp groups</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            marginBottom: '16px',
                            background: 'rgba(255, 107, 107, 0.1)',
                            color: '#ff6b6b',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '14px',
                            textAlign: 'center',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                        {/* <div className="flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
              onSuccess={(token) => setCaptchaToken(token)}
              options={{
                theme: 'light',
                size: 'normal',
              }}
            />
          </div> */}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}

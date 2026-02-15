'use client';

import { useState, useEffect } from 'react';

interface Contact {
    name: string;
    phone: string;
}

interface SyncResult {
    name: string;
    status: string;
    error?: string;
}

export default function GoogleSyncPage() {
    const [authUrl, setAuthUrl] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [rawInput, setRawInput] = useState('');
    const [results, setResults] = useState<SyncResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Check if we have a code in the URL (OAuth callback)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            handleCallback(code);
        }
    }, []);

    const getAuthUrl = async () => {
        try {
            const res = await fetch('/api/contacts/google-sync');
            const data = await res.json();
            setAuthUrl(data.authUrl);
        } catch (err) {
            setMessage('❌ Failed to get auth URL: ' + (err as Error).message);
        }
    };

    const handleCallback = async (code: string) => {
        try {
            const res = await fetch(`/api/contacts/google-sync?code=${encodeURIComponent(code)}`);
            const data = await res.json();
            if (data.tokens?.access_token) {
                setAccessToken(data.tokens.access_token);
                setMessage('✅ Google account connected!');
                // Clear code from URL
                window.history.replaceState({}, '', '/contacts/google-sync');
            }
        } catch (err) {
            setMessage('❌ Auth failed: ' + (err as Error).message);
        }
    };

    const parseContacts = () => {
        const lines = rawInput.split('\n').filter((l) => l.trim());
        const parsed: Contact[] = lines.map((line) => {
            const parts = line.split(',').map((p) => p.trim());
            return {
                name: parts[0] || 'Unknown',
                phone: parts[1] || parts[0],
            };
        });
        setContacts(parsed);
        setMessage(`📋 Parsed ${parsed.length} contacts`);
    };

    const syncContacts = async () => {
        if (!accessToken) {
            setMessage('⚠️ Connect your Google account first');
            return;
        }
        if (contacts.length === 0) {
            setMessage('⚠️ Parse contacts first');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/contacts/google-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, contacts }),
            });
            const data = await res.json();
            setResults(data.results || []);
            setMessage(data.message || 'Sync complete');
        } catch (err) {
            setMessage('❌ Sync failed: ' + (err as Error).message);
        }
        setLoading(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Google Contact Sync</h1>
                <p className="page-subtitle">Sync your phone contacts to your Google account</p>
            </div>

            {/* Step 1: Connect Google */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div>
                        <div className="card-title">Step 1: Connect Google Account</div>
                        <div className="card-subtitle">Authorize access to create contacts in your Google account</div>
                    </div>
                    {accessToken ? (
                        <span className="badge badge-success">✓ Connected</span>
                    ) : (
                        <span className="badge badge-warning">Not Connected</span>
                    )}
                </div>

                {!accessToken && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button className="btn btn-primary" onClick={getAuthUrl}>
                            🔑 Get Auth URL
                        </button>
                        {authUrl && (
                            <a href={authUrl} className="btn btn-secondary" target="_blank" rel="noreferrer">
                                🌐 Open Google Login
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Step 2: Input Contacts */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div>
                        <div className="card-title">Step 2: Input Contacts</div>
                        <div className="card-subtitle">One per line: Name, Phone Number</div>
                    </div>
                </div>
                <div className="form-group">
                    <textarea
                        className="form-textarea"
                        placeholder={`John Doe, +6281234567890\nJane Smith, +6289876543210`}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        style={{ fontFamily: 'monospace' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={parseContacts}>
                        📋 Parse
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={syncContacts}
                        disabled={loading || !accessToken || contacts.length === 0}
                    >
                        {loading ? <span className="spinner" /> : '🔄 Sync to Google'}
                    </button>
                    {message && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{message}</span>
                    )}
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Sync Results</div>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                                        <td>
                                            <span className={`badge ${r.status === 'synced' ? 'badge-success' : 'badge-danger'}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{r.error || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

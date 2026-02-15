'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';

type Status = 'disconnected' | 'connecting' | 'qr' | 'pairing' | 'connected';
type AuthMethod = 'code' | 'qr';

interface ProfileStatus {
    profileId: string;
    status: Status;
    qr: string | null;
    pairingCode: string | null;
    phoneNumber: string | null;
}

export default function AuthPage() {
    const [profiles, setProfiles] = useState<ProfileStatus[]>([]);
    const [activeProfile, setActiveProfile] = useState<string | null>(null);
    const [authMethod, setAuthMethod] = useState<AuthMethod>('code');
    const [phoneInput, setPhoneInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch all profile statuses
    const fetchProfiles = useCallback(async () => {
        try {
            const res = await fetch('/api/wa/status');
            const data = await res.json();
            if (data.profiles) {
                setProfiles(data.profiles);
            }
        } catch { /* ignore */ }
    }, []);

    // Poll statuses
    useEffect(() => {
        fetchProfiles();
        statusPollRef.current = setInterval(fetchProfiles, 3000);
        return () => {
            if (statusPollRef.current) clearInterval(statusPollRef.current);
        };
    }, [fetchProfiles]);

    // Render QR code
    useEffect(() => {
        if (activeProfile) {
            const profile = profiles.find(p => p.profileId === activeProfile);
            if (profile?.status === 'qr' && profile.qr && canvasRef.current) {
                QRCode.toCanvas(canvasRef.current, profile.qr, {
                    width: 280,
                    margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' },
                }).catch((err) => console.error('QR render error:', err));
            }
        }
    }, [profiles, activeProfile]);

    const getActiveProfileStatus = (): ProfileStatus | null => {
        if (!activeProfile) return null;
        return profiles.find(p => p.profileId === activeProfile) || null;
    };

    const addNewProfile = () => {
        const existing = profiles.map(p => parseInt(p.profileId));
        let nextId = 1;
        while (existing.includes(nextId) && nextId <= 10) nextId++;
        if (nextId > 10) {
            setError('Maksimal 10 profile!');
            return;
        }
        setActiveProfile(String(nextId));
        setError(null);
    };

    const handleConnectWithCode = async (profileId: string) => {
        if (!phoneInput.trim()) {
            setError('Masukkan nomor HP dulu! Contoh: 628123456789');
            return;
        }
        setLoading(true);
        setError(null);
        setActiveProfile(profileId);

        try {
            const res = await fetch('/api/wa/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: 'code',
                    phoneNumber: phoneInput.trim(),
                    profileId,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get pairing code');

            // Update profile in list
            await fetchProfiles();
        } catch (err) {
            setError((err as Error).message);
        }
        setLoading(false);
    };

    const handleConnectWithQR = async (profileId: string) => {
        setLoading(true);
        setError(null);
        setActiveProfile(profileId);

        try {
            await fetch('/api/wa/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId }),
            });
            await fetchProfiles();
        } catch (err) {
            setError((err as Error).message);
        }
        setLoading(false);
    };

    const handleCancel = async (profileId: string) => {
        setLoading(true);
        try {
            await fetch('/api/wa/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId }),
            });
        } catch { /* ignore */ }
        setActiveProfile(null);
        setPhoneInput('');
        setError(null);
        await fetchProfiles();
        setLoading(false);
    };

    const handleDisconnect = async (profileId: string) => {
        setLoading(true);
        try {
            await fetch('/api/wa/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId }),
            });
        } catch (err) {
            console.error('Disconnect failed:', err);
        }
        if (activeProfile === profileId) setActiveProfile(null);
        await fetchProfiles();
        setLoading(false);
    };

    const handleRetryCode = async (profileId: string) => {
        await handleCancel(profileId);
        setTimeout(() => {
            setActiveProfile(profileId);
        }, 500);
    };

    const formatCode = (code: string) => {
        const clean = code.replace(/[^A-Z0-9]/gi, '');
        if (clean.length > 4) return clean.slice(0, 4) + '-' + clean.slice(4);
        return clean;
    };

    const activeProfileData = getActiveProfileStatus();
    const connectedCount = profiles.filter(p => p.status === 'connected').length;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">WhatsApp Accounts</h1>
                <p className="page-subtitle">
                    Manage up to 10 WhatsApp accounts • {connectedCount} connected
                </p>
            </div>

            {/* Profile Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {profiles.map((profile) => (
                    <div
                        key={profile.profileId}
                        className="card"
                        onClick={() => {
                            if (profile.status === 'disconnected') {
                                setActiveProfile(profile.profileId);
                                setError(null);
                            }
                        }}
                        style={{
                            cursor: profile.status === 'disconnected' ? 'pointer' : 'default',
                            border: activeProfile === profile.profileId
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: profile.status === 'connected'
                                        ? 'linear-gradient(135deg, var(--accent), var(--accent-secondary))'
                                        : 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: profile.status === 'connected' ? '#000' : 'var(--text-muted)',
                                }}>
                                    {profile.profileId}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>
                                        Profile {profile.profileId}
                                    </div>
                                    {profile.phoneNumber && (
                                        <div style={{ fontSize: '13px', color: 'var(--accent)', fontFamily: 'monospace' }}>
                                            +{profile.phoneNumber}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className={`badge ${profile.status === 'connected' ? 'badge-success' :
                                    profile.status === 'connecting' || profile.status === 'pairing' ? 'badge-warning' :
                                        'badge-error'
                                }`} style={{ fontSize: '11px' }}>
                                {profile.status === 'connected' ? '✅ Online' :
                                    profile.status === 'connecting' ? '🔄 Connecting' :
                                        profile.status === 'pairing' ? '🔢 Pairing' :
                                            profile.status === 'qr' ? '📷 QR' :
                                                '⭕ Offline'}
                            </span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {profile.status === 'connected' && (
                                <button
                                    className="btn btn-danger"
                                    onClick={(e) => { e.stopPropagation(); handleDisconnect(profile.profileId); }}
                                    disabled={loading}
                                    style={{ fontSize: '12px', padding: '6px 14px', flex: 1 }}
                                >
                                    🔌 Logout
                                </button>
                            )}
                            {profile.status === 'disconnected' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={(e) => { e.stopPropagation(); setActiveProfile(profile.profileId); setError(null); }}
                                    style={{ fontSize: '12px', padding: '6px 14px', flex: 1 }}
                                >
                                    🔗 Connect
                                </button>
                            )}
                            {(profile.status === 'connecting' || profile.status === 'pairing' || profile.status === 'qr') && (
                                <button
                                    className="btn btn-danger"
                                    onClick={(e) => { e.stopPropagation(); handleCancel(profile.profileId); }}
                                    disabled={loading}
                                    style={{ fontSize: '12px', padding: '6px 14px', flex: 1 }}
                                >
                                    ✕ Cancel
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Add Profile Button */}
                {profiles.length < 10 && (
                    <div
                        className="card"
                        onClick={addNewProfile}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '120px',
                            border: '2px dashed var(--border)',
                            background: 'transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>+</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Add Profile</div>
                    </div>
                )}
            </div>

            {/* Connect Dialog */}
            {activeProfile && (!activeProfileData || activeProfileData.status === 'disconnected') && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">🔗 Connect Profile {activeProfile}</div>
                        <button
                            onClick={() => { setActiveProfile(null); setError(null); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '18px',
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div className="qr-container">
                        {/* Method Toggle */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '24px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '12px',
                            padding: '4px',
                            maxWidth: '360px',
                        }}>
                            <button
                                onClick={() => { setAuthMethod('code'); setError(null); }}
                                style={{
                                    flex: 1,
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    background: authMethod === 'code' ? 'var(--accent)' : 'transparent',
                                    color: authMethod === 'code' ? '#000' : 'var(--text-secondary)',
                                }}
                            >
                                🔢 Pairing Code
                            </button>
                            <button
                                onClick={() => { setAuthMethod('qr'); setError(null); }}
                                style={{
                                    flex: 1,
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    background: authMethod === 'qr' ? 'var(--accent)' : 'transparent',
                                    color: authMethod === 'qr' ? '#000' : 'var(--text-secondary)',
                                }}
                            >
                                📷 QR Code
                            </button>
                        </div>

                        {authMethod === 'code' ? (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                                    Link Profile {activeProfile}
                                </h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
                                    Enter your WhatsApp phone number to get a pairing code
                                </p>

                                <div style={{ width: '100%', maxWidth: '320px', marginBottom: '16px' }}>
                                    <input
                                        type="tel"
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value)}
                                        placeholder="628123456789"
                                        className="input"
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            fontSize: '16px',
                                            textAlign: 'center',
                                            letterSpacing: '1px',
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleConnectWithCode(activeProfile)}
                                    />
                                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                                        Format: kode negara + nomor (tanpa + atau 0)
                                    </p>
                                </div>

                                {error && (
                                    <div style={{
                                        color: '#ff6b6b',
                                        fontSize: '13px',
                                        marginBottom: '16px',
                                        padding: '8px 16px',
                                        background: 'rgba(255,107,107,0.1)',
                                        borderRadius: '8px',
                                    }}>
                                        ⚠️ {error}
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={() => handleConnectWithCode(activeProfile)}
                                    disabled={loading}
                                >
                                    {loading ? <span className="spinner" /> : '🔢 Get Pairing Code'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.6 }}>📱</div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                                    Scan QR — Profile {activeProfile}
                                </h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
                                    Click below to generate a QR code to scan
                                </p>

                                {error && (
                                    <div style={{
                                        color: '#ff6b6b',
                                        fontSize: '13px',
                                        marginBottom: '16px',
                                        padding: '8px 16px',
                                        background: 'rgba(255,107,107,0.1)',
                                        borderRadius: '8px',
                                    }}>
                                        ⚠️ {error}
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={() => handleConnectWithQR(activeProfile)}
                                    disabled={loading}
                                >
                                    {loading ? <span className="spinner" /> : '📷 Generate QR Code'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Pairing Code Display */}
            {activeProfile && activeProfileData?.status === 'pairing' && activeProfileData.pairingCode && (
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="qr-container">
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔢</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'var(--text-secondary)' }}>
                            Enter this code in WhatsApp (Profile {activeProfile})
                        </h3>
                        <div style={{
                            fontSize: '42px',
                            fontWeight: '800',
                            fontFamily: 'monospace',
                            letterSpacing: '6px',
                            color: 'var(--accent)',
                            background: 'rgba(37, 211, 102, 0.08)',
                            border: '2px dashed var(--accent)',
                            borderRadius: '16px',
                            padding: '24px 40px',
                            marginBottom: '24px',
                            userSelect: 'all',
                            cursor: 'pointer',
                        }}
                            title="Click to select"
                        >
                            {formatCode(activeProfileData.pairingCode)}
                        </div>
                        <div style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: '12px',
                            padding: '16px 24px',
                            maxWidth: '340px',
                            marginBottom: '20px',
                        }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                                Open <strong style={{ color: 'var(--text-primary)' }}>WhatsApp</strong> on your phone:
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8', marginTop: '8px' }}>
                                ⚙️ Settings → 📱 Linked Devices → 🔗 Link a Device → ⋮ Link with phone number instead
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleRetryCode(activeProfile)}
                                disabled={loading}
                                style={{ fontSize: '13px' }}
                            >
                                🔄 New Code
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleCancel(activeProfile)}
                                disabled={loading}
                                style={{ fontSize: '13px' }}
                            >
                                ✕ Cancel
                            </button>
                        </div>
                        <span className="badge badge-warning">⏳ Waiting for confirmation...</span>
                    </div>
                </div>
            )}

            {/* QR Code Display */}
            {activeProfile && activeProfileData?.status === 'qr' && (
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="qr-container">
                        <div className="qr-wrapper">
                            <canvas ref={canvasRef} />
                        </div>
                        <div className="qr-status">
                            <span className="badge badge-warning">⏳ Waiting for scan (Profile {activeProfile})</span>
                            <p className="qr-status-text" style={{ marginBottom: '16px' }}>
                                Open WhatsApp → Settings → Linked Devices → Link a Device
                            </p>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleCancel(activeProfile)}
                                disabled={loading}
                                style={{ fontSize: '13px' }}
                            >
                                ✕ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connecting spinner */}
            {activeProfile && activeProfileData?.status === 'connecting' && (
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="qr-container">
                        <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '3px', marginBottom: '24px' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                            Connecting Profile {activeProfile}...
                        </p>
                        <button
                            className="btn btn-danger"
                            onClick={() => handleCancel(activeProfile)}
                            disabled={loading}
                            style={{ fontSize: '13px' }}
                        >
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

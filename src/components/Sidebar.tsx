'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const NAV_ITEMS = [
    { label: 'Main', type: 'section' as const },
    { href: '/', icon: '📊', label: 'Dashboard' },
    { href: '/auth', icon: '🔐', label: 'WA Connection' },

    { label: 'Contacts', type: 'section' as const },
    { href: '/contacts', icon: '📇', label: 'VCF Converter' },
    { href: '/contacts/google-sync', icon: '🔄', label: 'Google Sync' },
    { href: '/contacts/validator', icon: '✅', label: 'WA Validator' },

    { label: 'Groups', type: 'section' as const },
    { href: '/groups', icon: '👥', label: 'Group Manager' },
    { href: '/groups/create', icon: '➕', label: 'Auto Create' },

    { label: 'Messaging', type: 'section' as const },
    { href: '/broadcast', icon: '📢', label: 'Broadcast' },
];

interface ConnectionStatus {
    status: 'disconnected' | 'connecting' | 'qr' | 'connected';
    phoneNumber?: string;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [status, setStatus] = useState<ConnectionStatus>({ status: 'disconnected' });
    const supabase = createSupabaseBrowserClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/wa/status');
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data); // Wait, new API returns { profiles: [...] }
                    // Sidebar expects simple status. We might need to adjust Sidebar to handle multi-profile or just show "Active" count.
                    // For now, let's just make it robust to ignore errors if format changed.
                    if (data.profiles && data.profiles.length > 0) {
                        // Just show summary or first profile?
                        // Let's assume we want to show generic "Connected" if any are connected.
                        const anyConnected = data.profiles.some((p: any) => p.status === 'connected');
                        setStatus({ status: anyConnected ? 'connected' : 'disconnected' });
                    }
                }
            } catch {
                // ignore
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const statusLabel = {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        qr: 'Scan QR Code',
        connected: 'Connected',
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <Link href="/" className="sidebar-logo" onClick={onClose}>
                        <div className="sidebar-logo-icon">💬</div>
                        <div>
                            <div className="sidebar-logo-text">WA Manager</div>
                            <div className="sidebar-logo-sub">Group & Broadcast Tool</div>
                        </div>
                    </Link>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item, i) => {
                        if (item.type === 'section') {
                            return (
                                <div key={i} className="sidebar-section-label">
                                    {item.label}
                                </div>
                            );
                        }

                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href!}
                                className={`sidebar-link ${isActive ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                <span className="sidebar-link-icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div className="sidebar-status">
                            <span className={`status-dot ${status.status === 'connected' ? 'connected' : status.status === 'connecting' || status.status === 'qr' ? 'connecting' : 'disconnected'}`} />
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {statusLabel[status.status]}
                            </span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

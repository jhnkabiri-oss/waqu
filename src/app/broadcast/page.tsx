'use client';

import { useState, useEffect } from 'react';

interface GroupInfo {
    id: string;
    subject: string;
    size: number;
}

export default function BroadcastPage() {
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
    const [recipientMode, setRecipientMode] = useState<'groups' | 'numbers'>('groups');
    const [customNumbers, setCustomNumbers] = useState('');
    const [message, setMessage] = useState('');
    const [minDelay, setMinDelay] = useState(10);
    const [maxDelay, setMaxDelay] = useState(30);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [broadcastResult, setBroadcastResult] = useState<{ jobId: string; broadcastId: string } | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups || []);
            }
        } catch {
            // ignore
        }
    };

    const toggleGroup = (id: string) => {
        setSelectedRecipients((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const sendBroadcast = async () => {
        let recipients: string[] = [];

        if (recipientMode === 'groups') {
            recipients = Array.from(selectedRecipients);
        } else {
            recipients = customNumbers
                .split('\n')
                .map((n) => n.trim())
                .filter((n) => n.length > 0);
        }

        if (recipients.length === 0) {
            setStatus('⚠️ Select recipients first');
            return;
        }
        if (!message.trim()) {
            setStatus('⚠️ Message is required');
            return;
        }

        setLoading(true);
        setStatus('⏳ Queueing broadcast...');

        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    message: message.trim(),
                    minDelay,
                    maxDelay,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setBroadcastResult({ jobId: data.jobId, broadcastId: data.broadcastId });
                setStatus(`✅ ${data.message}`);
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (err) {
            setStatus('❌ ' + (err as Error).message);
        }
        setLoading(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Broadcast Messages</h1>
                <p className="page-subtitle">Send messages to multiple groups or contacts with smart delay</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left: Recipients */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Recipients</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            className={`btn btn-sm ${recipientMode === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRecipientMode('groups')}
                        >
                            👥 Groups
                        </button>
                        <button
                            className={`btn btn-sm ${recipientMode === 'numbers' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setRecipientMode('numbers')}
                        >
                            📱 Phone Numbers
                        </button>
                    </div>

                    {recipientMode === 'groups' ? (
                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {groups.length > 0 ? groups.map((g) => (
                                <label
                                    key={g.id}
                                    className="checkbox-group"
                                    style={{
                                        padding: '10px 12px',
                                        background: selectedRecipients.has(g.id) ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${selectedRecipients.has(g.id) ? 'var(--border-accent)' : 'transparent'}`,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedRecipients.has(g.id)}
                                        onChange={() => toggleGroup(g.id)}
                                    />
                                    <span style={{ flex: 1, fontSize: '13px' }}>{g.subject}</span>
                                    <span className="badge badge-info" style={{ fontSize: '10px' }}>{g.size}</span>
                                </label>
                            )) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
                                    No groups loaded. Connect WA first.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <textarea
                                className="form-textarea"
                                placeholder={`6281234567890\n6289876543210\n6285551234567`}
                                value={customNumbers}
                                onChange={(e) => setCustomNumbers(e.target.value)}
                                style={{ minHeight: '300px', fontFamily: 'monospace' }}
                            />
                        </div>
                    )}

                    {recipientMode === 'groups' && selectedRecipients.size > 0 && (
                        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--accent)' }}>
                            {selectedRecipients.size} group(s) selected
                        </div>
                    )}
                </div>

                {/* Right: Message & Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Message</div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <textarea
                                className="form-textarea"
                                placeholder="Type your broadcast message here..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                style={{ minHeight: '200px' }}
                            />
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            {message.length} characters
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">⏱️ Delay Settings</div>
                            <div className="card-subtitle">Random delay between messages to avoid ban</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Min Delay (seconds)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={minDelay}
                                    onChange={(e) => setMinDelay(Number(e.target.value))}
                                    min={5}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Max Delay (seconds)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={maxDelay}
                                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                                    min={10}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--warning)' }}>
                            ⚠️ Recommended: 10-30 seconds delay to minimize ban risk
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-lg"
                        onClick={sendBroadcast}
                        disabled={loading}
                        style={{ width: '100%' }}
                    >
                        {loading ? <span className="spinner" /> : '📢 Send Broadcast'}
                    </button>

                    {status && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {status}
                        </div>
                    )}

                    {broadcastResult && (
                        <div className="card" style={{ borderColor: 'var(--border-accent)' }}>
                            <div style={{ fontSize: '13px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Job ID:</strong>{' '}
                                    <code style={{ color: 'var(--accent)' }}>{broadcastResult.jobId}</code>
                                </div>
                                <div>
                                    <strong>Broadcast ID:</strong>{' '}
                                    <code style={{ color: 'var(--accent)' }}>{broadcastResult.broadcastId}</code>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

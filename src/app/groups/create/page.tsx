'use client';

import { useState, useRef, useEffect } from 'react';

interface GroupInput {
    name: string;
    description: string;
    members: string[];
}

interface ProfileInfo {
    profileId: string;
    status: string;
    phoneNumber: string | null;
}

export default function GroupCreatePage() {
    const [groups, setGroups] = useState<GroupInput[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [results, setResults] = useState<Array<{ name: string; status: string; id?: string; error?: string }>>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const [profileId, setProfileId] = useState('1');
    const [connectedProfiles, setConnectedProfiles] = useState<ProfileInfo[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/wa/status');
                const data = await res.json();
                if (data.profiles) {
                    const connected = data.profiles.filter((p: ProfileInfo) => p.status === 'connected');
                    setConnectedProfiles(connected);
                    if (connected.length > 0 && !connected.find((p: ProfileInfo) => p.profileId === profileId)) {
                        setProfileId(connected[0].profileId);
                    }
                }
            } catch { /* ignore */ }
        };
        fetchProfiles();
        const interval = setInterval(fetchProfiles, 5000);
        return () => clearInterval(interval);
    }, [profileId]);

    // Form inputs
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [membersText, setMembersText] = useState('');
    const [delay, setDelay] = useState(5);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            // File only contains phone numbers (one per line)
            const lines = text.split('\n').filter((l) => l.trim());
            const phones = lines.map((l) => l.trim().replace(/[^0-9+]/g, '')).filter((p) => p.length >= 8);
            setMembersText(phones.join('\n'));
            setMessage(`📄 Loaded ${phones.length} phone numbers from file`);
        };
        reader.readAsText(file);
    };

    const addGroup = () => {
        if (!groupName.trim()) {
            setMessage('⚠️ Masukkan nama grup dulu!');
            return;
        }

        const members = membersText
            .split('\n')
            .map((m) => m.trim().replace(/[^0-9+]/g, ''))
            .filter((m) => m.length >= 8);

        if (members.length === 0) {
            setMessage('⚠️ Masukkan nomor member dulu!');
            return;
        }

        const newGroup: GroupInput = {
            name: groupName.trim(),
            description: groupDescription.trim(),
            members,
        };

        setGroups((prev) => [...prev, newGroup]);
        setMessage(`✅ Group "${newGroup.name}" added with ${members.length} members`);

        // Reset form
        setGroupName('');
        setGroupDescription('');
        setMembersText('');
    };

    const removeGroup = (index: number) => {
        setGroups((prev) => prev.filter((_, i) => i !== index));
    };

    const createGroups = async () => {
        if (groups.length === 0) return;
        setLoading(true);
        setMessage('⏳ Creating groups...');
        setResults([]);

        try {
            const res = await fetch('/api/groups/create-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groups, delay, profileId }),
            });

            const data = await res.json();
            if (res.ok) {
                setResults(data.results || []);
                setMessage(`✅ ${data.message}`);
                setGroups([]);
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch (err) {
            setMessage('❌ ' + (err as Error).message);
        }
        setLoading(false);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Auto Create Groups</h1>
                <p className="page-subtitle">Create WhatsApp groups in bulk with custom settings</p>
            </div>

            {/* Profile Selector */}
            {connectedProfiles.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        📱 Use Account:
                    </span>
                    <select
                        className="input"
                        value={profileId}
                        onChange={(e) => setProfileId(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                        }}
                    >
                        {connectedProfiles.map((p) => (
                            <option key={p.profileId} value={p.profileId}>
                                Profile {p.profileId} — +{p.phoneNumber}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {connectedProfiles.length === 0 && (
                <div style={{
                    padding: '16px',
                    marginBottom: '20px',
                    background: 'rgba(255,107,107,0.08)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ff6b6b',
                    fontSize: '13px',
                    textAlign: 'center',
                }}>
                    ⚠️ No WhatsApp account connected. Go to <a href="/auth" style={{ color: 'var(--accent)' }}>Auth page</a> to connect.
                </div>
            )}

            {/* Group Settings Form */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div className="card-title">➕ Add New Group</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nama Grup *</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="Contoh: Team Alpha"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px' }}
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Delay per Group</label>
                        <select
                            className="input"
                            value={delay}
                            onChange={(e) => setDelay(Number(e.target.value))}
                            style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        >
                            {Array.from({ length: 14 }, (_, i) => i + 2).map((s) => (
                                <option key={s} value={s}>
                                    {s} detik
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Deskripsi Grup</label>
                    <textarea
                        className="form-textarea"
                        placeholder="Deskripsi grup (opsional)..."
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Members (nomor HP per baris) *</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {membersText.split('\n').filter(l => l.trim()).length} nomor
                        </span>
                    </label>
                    <textarea
                        className="form-textarea"
                        placeholder={`6281234567890\n6289876543210\n6285551234567`}
                        value={membersText}
                        onChange={(e) => setMembersText(e.target.value)}
                        style={{ minHeight: '120px', fontFamily: 'monospace' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".txt"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileRef.current?.click()}
                    >
                        📂 Upload TXT
                    </button>
                    <button className="btn btn-primary" onClick={addGroup}>
                        ➕ Add Group to Queue
                    </button>
                </div>
            </div>

            {/* Groups Queue Preview */}
            {groups.length > 0 && (
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title">Preview ({groups.length} groups)</div>
                            <div className="card-subtitle">Delay: {delay} detik per group</div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={createGroups}
                            disabled={loading}
                        >
                            {loading ? <span className="spinner" /> : `🚀 Create ${groups.length} Groups`}
                        </button>
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Group Name</th>
                                    <th>Description</th>
                                    <th>Members</th>
                                    <th style={{ width: '60px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((g, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{g.name}</td>
                                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                            {g.description || '—'}
                                        </td>
                                        <td>
                                            <span className="badge badge-info">{g.members.length} members</span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => removeGroup(i)}
                                                style={{
                                                    background: 'rgba(255,107,107,0.15)',
                                                    color: '#ff6b6b',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '4px 10px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Results</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {results.map((r, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                }}
                            >
                                <span className={`badge ${r.status === 'created' ? 'badge-success' : 'badge-error'}`}>
                                    {r.status === 'created' ? '✅ Created' : '❌ Failed'}
                                </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</span>
                                {r.error && (
                                    <span style={{ color: '#ff6b6b', fontSize: '12px', marginLeft: 'auto' }}>{r.error}</span>
                                )}
                                {r.id && (
                                    <code style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 'auto' }}>
                                        {r.id}
                                    </code>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {message && (
                <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {message}
                </div>
            )}
        </div>
    );
}

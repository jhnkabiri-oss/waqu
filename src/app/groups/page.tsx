'use client';

import { useState, useEffect } from 'react';

interface GroupInfo {
    id: string;
    subject: string;
    desc?: string;
    participants: Array<{ id: string; admin?: string | null }>;
    size: number;
}

export default function GroupsPage() {
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [bulkDesc, setBulkDesc] = useState('');
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [membersInput, setMembersInput] = useState('');
    const [profileId, setProfileId] = useState('1');
    const [connectedProfiles, setConnectedProfiles] = useState<Array<{ profileId: string; status: string; phoneNumber: string | null }>>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/wa/status');
                const data = await res.json();
                if (data.profiles) {
                    const connected = data.profiles.filter((p: any) => p.status === 'connected');
                    setConnectedProfiles(connected);
                    if (connected.length > 0 && !connected.find((p: any) => p.profileId === profileId)) {
                        setProfileId(connected[0].profileId);
                    }
                }
            } catch { /* ignore */ }
        };
        fetchProfiles();
        const interval = setInterval(fetchProfiles, 5000);
        return () => clearInterval(interval);
    }, [profileId]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/groups?profile=${profileId}`);
            if (!res.ok) {
                const data = await res.json();
                setMessage('⚠️ ' + (data.error || 'Failed to fetch'));
                setGroups([]); // Clear groups on error
                setLoading(false);
                return;
            }
            const data = await res.json();
            setGroups(data.groups || []);
            setMessage(`Loaded ${data.groups?.length || 0} groups`);
        } catch (err) {
            setMessage('❌ ' + (err as Error).message);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
    }, [profileId]);

    const toggleSelect = (id: string) => {
        setSelectedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedGroups.size === filteredGroups.length) {
            setSelectedGroups(new Set());
        } else {
            setSelectedGroups(new Set(filteredGroups.map((g) => g.id)));
        }
    };

    const bulkAddMembers = async () => {
        if (selectedGroups.size === 0 || !membersInput.trim()) return;
        setLoading(true);

        // Parse numbers
        const numbers = membersInput
            .split(/[\n,]+/)
            .map(n => n.trim().replace(/\D/g, ''))
            .filter(n => n.length > 5)
            .map(n => n + '@s.whatsapp.net');

        if (numbers.length === 0) {
            setMessage('⚠️ No valid numbers found');
            setLoading(false);
            return;
        }

        let success = 0;
        let fail = 0;

        for (const groupId of selectedGroups) {
            try {
                const res = await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        groupId,
                        action: 'addParticipants',
                        data: { participants: numbers },
                        profileId,
                    }),
                });
                if (res.ok) success++;
                else fail++;
            } catch {
                fail++;
            }
        }

        setMessage(`✅ Added members to ${success} groups, ❌ Failed: ${fail}`);
        setShowAddMembers(false);
        setMembersInput('');
        setLoading(false);
        fetchGroups(); // Refresh to see updated counts
    };

    const bulkUpdateDescription = async () => {
        if (selectedGroups.size === 0 || !bulkDesc.trim()) return;
        setLoading(true);
        let success = 0;
        let fail = 0;

        for (const groupId of selectedGroups) {
            try {
                const res = await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        groupId,
                        action: 'updateDescription',
                        data: { description: bulkDesc },
                        profileId,
                    }),
                });
                if (res.ok) success++;
                else fail++;
            } catch {
                fail++;
            }
        }

        setMessage(`✅ Updated: ${success}, ❌ Failed: ${fail}`);
        setShowBulkEdit(false);
        setBulkDesc('');
        setLoading(false);
    };

    const filteredGroups = groups.filter((g) =>
        g.subject.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Group Manager</h1>
                <p className="page-subtitle">View and manage all your WhatsApp groups</p>
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
                                Profile {p.profileId} — {p.phoneNumber ? '+' + p.phoneNumber : 'Connected'}
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

            {/* Actions bar */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={fetchGroups} disabled={loading}>
                        {loading ? <span className="spinner" /> : '🔄 Refresh Groups'}
                    </button>
                    {selectedGroups.size > 0 && (
                        <>
                            <button className="btn btn-secondary" onClick={() => { setShowBulkEdit(!showBulkEdit); setShowAddMembers(false); }}>
                                ✏️ Bulk Edit Description ({selectedGroups.size})
                            </button>
                            <button className="btn btn-secondary" onClick={() => { setShowAddMembers(!showAddMembers); setShowBulkEdit(false); }}>
                                ➕ Add Members ({selectedGroups.size})
                            </button>
                        </>
                    )}
                    <div style={{ flex: 1 }} />
                    <input
                        className="form-input"
                        style={{ maxWidth: '300px' }}
                        placeholder="🔍 Search groups..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {message && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{message}</span>
                    )}
                </div>

                {showAddMembers && (
                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Add Members to {selectedGroups.size} groups</label>
                            <p className="text-sm text-secondary" style={{ marginBottom: '8px' }}>
                                Enter numbers separated by comma or new line (e.g. 628123456789)
                            </p>
                            <textarea
                                className="form-textarea"
                                placeholder="Paste numbers here..."
                                value={membersInput}
                                onChange={(e) => setMembersInput(e.target.value)}
                                style={{ minHeight: '120px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary btn-sm" onClick={bulkAddMembers} disabled={loading}>
                                Add Members
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMembers(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {showBulkEdit && (
                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div className="form-group">
                            <label className="form-label">New Description for {selectedGroups.size} groups</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Enter new group description..."
                                value={bulkDesc}
                                onChange={(e) => setBulkDesc(e.target.value)}
                                style={{ minHeight: '80px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary btn-sm" onClick={bulkUpdateDescription} disabled={loading}>
                                Apply
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkEdit(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Groups table */}
            {filteredGroups.length > 0 ? (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>
                                        <label className="checkbox-group">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.size === filteredGroups.length && filteredGroups.length > 0}
                                                onChange={selectAll}
                                            />
                                        </label>
                                    </th>
                                    <th>Group Name</th>
                                    <th>Members</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroups.map((g) => (
                                    <tr key={g.id}>
                                        <td>
                                            <label className="checkbox-group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedGroups.has(g.id)}
                                                    onChange={() => toggleSelect(g.id)}
                                                />
                                            </label>
                                        </td>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {g.subject}
                                        </td>
                                        <td>
                                            <span className="badge badge-info">{g.size}</span>
                                        </td>
                                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {g.desc || '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    title="Copy Group ID"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(g.id);
                                                        setMessage(`Copied: ${g.id}`);
                                                    }}
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <div className="empty-state-title">No Groups Found</div>
                        <div className="empty-state-text">
                            {loading
                                ? 'Loading groups...'
                                : connectedProfiles.length === 0
                                    ? 'No connected accounts found. Go to Auth page.'
                                    : `Profile ${profileId} not connected or has no groups.`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

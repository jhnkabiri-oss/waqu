'use client';

import { useState, useRef } from 'react';

// Country code lookup (reuse from contacts page)
const COUNTRY_CODES: Array<{ prefix: string; country: string; flag: string }> = [
    { prefix: '233', country: 'Ghana', flag: '🇬🇭' },
    { prefix: '234', country: 'Nigeria', flag: '🇳🇬' },
    { prefix: '254', country: 'Kenya', flag: '🇰🇪' },
    { prefix: '255', country: 'Tanzania', flag: '🇹🇿' },
    { prefix: '256', country: 'Uganda', flag: '🇺🇬' },
    { prefix: '237', country: 'Cameroon', flag: '🇨🇲' },
    { prefix: '250', country: 'Rwanda', flag: '🇷🇼' },
    { prefix: '260', country: 'Zambia', flag: '🇿🇲' },
    { prefix: '212', country: 'Morocco', flag: '🇲🇦' },
    { prefix: '213', country: 'Algeria', flag: '🇩🇿' },
    { prefix: '220', country: 'Gambia', flag: '🇬🇲' },
    { prefix: '221', country: 'Senegal', flag: '🇸🇳' },
    { prefix: '225', country: 'Ivory Coast', flag: '🇨🇮' },
    { prefix: '880', country: 'Bangladesh', flag: '🇧🇩' },
    { prefix: '855', country: 'Cambodia', flag: '🇰🇭' },
    { prefix: '852', country: 'Hong Kong', flag: '🇭🇰' },
    { prefix: '966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { prefix: '971', country: 'UAE', flag: '🇦🇪' },
    { prefix: '974', country: 'Qatar', flag: '🇶🇦' },
    { prefix: '964', country: 'Iraq', flag: '🇮🇶' },
    { prefix: '961', country: 'Lebanon', flag: '🇱🇧' },
    { prefix: '962', country: 'Jordan', flag: '🇯🇴' },
    { prefix: '351', country: 'Portugal', flag: '🇵🇹' },
    { prefix: '353', country: 'Ireland', flag: '🇮🇪' },
    { prefix: '380', country: 'Ukraine', flag: '🇺🇦' },
    { prefix: '420', country: 'Czech Rep.', flag: '🇨🇿' },
    { prefix: '62', country: 'Indonesia', flag: '🇮🇩' },
    { prefix: '60', country: 'Malaysia', flag: '🇲🇾' },
    { prefix: '63', country: 'Philippines', flag: '🇵🇭' },
    { prefix: '65', country: 'Singapore', flag: '🇸🇬' },
    { prefix: '66', country: 'Thailand', flag: '🇹🇭' },
    { prefix: '84', country: 'Vietnam', flag: '🇻🇳' },
    { prefix: '86', country: 'China', flag: '🇨🇳' },
    { prefix: '81', country: 'Japan', flag: '🇯🇵' },
    { prefix: '82', country: 'South Korea', flag: '🇰🇷' },
    { prefix: '91', country: 'India', flag: '🇮🇳' },
    { prefix: '92', country: 'Pakistan', flag: '🇵🇰' },
    { prefix: '98', country: 'Iran', flag: '🇮🇷' },
    { prefix: '90', country: 'Turkey', flag: '🇹🇷' },
    { prefix: '20', country: 'Egypt', flag: '🇪🇬' },
    { prefix: '27', country: 'South Africa', flag: '🇿🇦' },
    { prefix: '33', country: 'France', flag: '🇫🇷' },
    { prefix: '34', country: 'Spain', flag: '🇪🇸' },
    { prefix: '39', country: 'Italy', flag: '🇮🇹' },
    { prefix: '44', country: 'UK', flag: '🇬🇧' },
    { prefix: '49', country: 'Germany', flag: '🇩🇪' },
    { prefix: '55', country: 'Brazil', flag: '🇧🇷' },
    { prefix: '52', country: 'Mexico', flag: '🇲🇽' },
    { prefix: '54', country: 'Argentina', flag: '🇦🇷' },
    { prefix: '57', country: 'Colombia', flag: '🇨🇴' },
    { prefix: '1', country: 'USA/Canada', flag: '🇺🇸' },
    { prefix: '7', country: 'Russia', flag: '🇷🇺' },
];

function detectCountry(phone: string): { country: string; flag: string } | null {
    const clean = phone.replace(/^\+/, '');
    for (const cc of COUNTRY_CODES) {
        if (clean.startsWith(cc.prefix)) {
            return { country: cc.country, flag: cc.flag };
        }
    }
    return null;
}

interface ValidateResult {
    phone: string;
    exists: boolean;
    jid?: string;
    country?: string;
    flag?: string;
}

export default function ValidatorPage() {
    const [rawInput, setRawInput] = useState('');
    const [results, setResults] = useState<ValidateResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState('');
    const [delay, setDelay] = useState(2);
    const [profileId, setProfileId] = useState('1');
    const [connectedProfiles, setConnectedProfiles] = useState<Array<{ profileId: string; status: string; phoneNumber: string | null }>>([]);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const fileRef = useRef<HTMLInputElement>(null);

    // Fetch connected profiles
    useState(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/wa/status');
                const data = await res.json();
                if (data.profiles) {
                    const connected = data.profiles.filter((p: any) => p.status === 'connected');
                    setConnectedProfiles(connected);
                    if (connected.length > 0) {
                        setProfileId(connected[0].profileId);
                    }
                }
            } catch { /* ignore */ }
        };
        fetchProfiles();
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const ext = file.name.split('.').pop()?.toLowerCase();

            if (ext === 'vcf') {
                const vcards = text.split('BEGIN:VCARD').filter(Boolean);
                const lines: string[] = [];
                for (const vcard of vcards) {
                    const telMatch = vcard.match(/TEL[^:]*:([\d+\-\s]+)/);
                    if (telMatch) {
                        lines.push(telMatch[1].replace(/[^0-9+]/g, ''));
                    }
                }
                setRawInput(lines.join('\n'));
                setMessage(`📄 Loaded ${lines.length} numbers from VCF`);
            } else {
                setRawInput(text);
                setMessage(`📄 Loaded file`);
            }
        };
        reader.readAsText(file);
        if (fileRef.current) fileRef.current.value = '';
    };

    const parseNumbers = (): string[] => {
        return rawInput
            .split(/[\n,]+/)
            .map(n => n.trim().replace(/[^0-9]/g, ''))
            .filter(n => n.length >= 8);
    };

    const validate = async () => {
        const numbers = parseNumbers();
        if (numbers.length === 0) {
            setMessage('⚠️ No valid numbers found');
            return;
        }

        setLoading(true);
        setResults([]);
        setProgress(`⏳ Validating ${numbers.length} numbers...`);

        try {
            const res = await fetch('/api/wa/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers, profileId, delay }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMessage('❌ ' + (data.error || 'Validation failed'));
                setProgress('');
                setLoading(false);
                return;
            }

            // Enrich results with country info
            const enriched: ValidateResult[] = (data.results || []).map((r: any) => {
                const detected = detectCountry(r.phone);
                return { ...r, country: detected?.country, flag: detected?.flag };
            });

            setResults(enriched);
            setMessage(`✅ Done! ${data.active} active, ${data.inactive} inactive out of ${data.total}`);
            setProgress('');
        } catch (err) {
            setMessage('❌ ' + (err as Error).message);
            setProgress('');
        }

        setLoading(false);
    };

    const filteredResults = results.filter(r => {
        if (filter === 'active') return r.exists;
        if (filter === 'inactive') return !r.exists;
        return true;
    });

    const activeCount = results.filter(r => r.exists).length;
    const inactiveCount = results.filter(r => !r.exists).length;

    const copyNumbers = (type: 'active' | 'inactive' | 'all') => {
        const nums = results
            .filter(r => type === 'all' ? true : type === 'active' ? r.exists : !r.exists)
            .map(r => r.phone);
        navigator.clipboard.writeText(nums.join('\n'));
        setMessage(`📋 Copied ${nums.length} ${type} numbers to clipboard`);
    };

    const downloadCSV = () => {
        const rows = ['Phone,Status,Country'];
        results.forEach(r => {
            rows.push(`${r.phone},${r.exists ? 'Active' : 'Inactive'},${r.country || 'Unknown'}`);
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wa-validation-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">WhatsApp Number Validator</h1>
                <p className="page-subtitle">Check if phone numbers have active WhatsApp accounts</p>
            </div>

            {/* Settings */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div className="card-title">⚙️ Settings</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">WA Profile</label>
                        <select
                            className="input"
                            value={profileId}
                            onChange={(e) => setProfileId(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px' }}
                        >
                            {connectedProfiles.length > 0 ? (
                                connectedProfiles.map((p) => (
                                    <option key={p.profileId} value={p.profileId}>
                                        Profile {p.profileId} {p.phoneNumber ? `(${p.phoneNumber})` : ''}
                                    </option>
                                ))
                            ) : (
                                <option value="1">Profile 1</option>
                            )}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">⏱️ Delay Per Batch: {delay}s</label>
                        <input
                            type="range"
                            min={1}
                            max={10}
                            value={delay}
                            onChange={(e) => setDelay(Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '8px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>1s (Cepat)</span>
                            <span>5s (Aman)</span>
                            <span>10s (Sangat Aman)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div className="card-title">📱 Input Numbers</div>
                </div>

                <div className="form-group">
                    <textarea
                        className="form-textarea"
                        placeholder={"Paste phone numbers here (one per line or comma-separated)...\n\nExample:\n628123456789\n233245716959\n2348012345678"}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        style={{ minHeight: '180px', fontFamily: 'monospace' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".txt,.vcf,.csv"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileRef.current?.click()}
                    >
                        📂 Upload File
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={validate}
                        disabled={loading || !rawInput.trim()}
                        style={{ background: !loading && rawInput.trim() ? 'var(--accent)' : undefined }}
                    >
                        {loading ? '⏳ Validating...' : `🔍 Validate (${parseNumbers().length} numbers)`}
                    </button>
                    {progress && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{progress}</span>
                    )}
                    {message && !progress && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{message}</span>
                    )}
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📊 Results ({results.length} numbers)</div>
                    </div>

                    {/* Stats Bar */}
                    <div style={{
                        display: 'flex', gap: '16px', padding: '16px',
                        background: 'var(--bg-tertiary)', borderRadius: '12px', marginBottom: '16px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            flex: 1, minWidth: '120px', textAlign: 'center',
                            padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px'
                        }}>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent)' }}>
                                {activeCount}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>✅ Active WhatsApp</div>
                        </div>
                        <div style={{
                            flex: 1, minWidth: '120px', textAlign: 'center',
                            padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px'
                        }}>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>
                                {inactiveCount}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>❌ Not on WhatsApp</div>
                        </div>
                        <div style={{
                            flex: 1, minWidth: '120px', textAlign: 'center',
                            padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px'
                        }}>
                            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {results.length > 0 ? `${Math.round((activeCount / results.length) * 100)}%` : '0%'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📈 Active Rate</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button
                            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({results.length})
                        </button>
                        <button
                            className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('active')}
                            style={filter === 'active' ? { background: '#22c55e' } : {}}
                        >
                            ✅ Active ({activeCount})
                        </button>
                        <button
                            className={`btn btn-sm ${filter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('inactive')}
                            style={filter === 'inactive' ? { background: '#ef4444' } : {}}
                        >
                            ❌ Inactive ({inactiveCount})
                        </button>

                        <div style={{ flex: 1 }} />

                        <button className="btn btn-secondary btn-sm" onClick={() => copyNumbers('active')}>
                            📋 Copy Active
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => copyNumbers('inactive')}>
                            📋 Copy Inactive
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={downloadCSV}>
                            📥 Download CSV
                        </button>
                    </div>

                    {/* Results Table */}
                    <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Phone</th>
                                    <th>Country</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((r, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <code style={{
                                                color: 'var(--text-muted)',
                                                background: 'var(--bg-tertiary)',
                                                padding: '2px 8px',
                                                borderRadius: '4px'
                                            }}>
                                                {r.phone}
                                            </code>
                                        </td>
                                        <td style={{ fontSize: '13px' }}>
                                            {r.flag ? `${r.flag} ${r.country}` : <span style={{ color: 'var(--text-muted)' }}>❓</span>}
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                background: r.exists ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: r.exists ? '#22c55e' : '#ef4444',
                                            }}>
                                                {r.exists ? '✅ Active' : '❌ Inactive'}
                                            </span>
                                        </td>
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

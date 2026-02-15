'use client';

import { useState, useRef } from 'react';

interface Contact {
    name: string;
    phone: string;
}

export default function ContactsPage() {
    const [rawInput, setRawInput] = useState('');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    // Name prefix settings
    const [namePrefix, setNamePrefix] = useState('');
    const [startNumber, setStartNumber] = useState(1);
    const [continueFrom, setContinueFrom] = useState('');

    // Split settings
    const [splitSize, setSplitSize] = useState(200);
    const [batches, setBatches] = useState<Contact[][]>([]);

    // Active tab
    const [activeTab, setActiveTab] = useState<'convert' | 'split'>('convert');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const ext = file.name.split('.').pop()?.toLowerCase();

            if (ext === 'vcf') {
                // Parse VCF: extract phone numbers
                const vcards = text.split('BEGIN:VCARD').filter(Boolean);
                const lines: string[] = [];
                for (const vcard of vcards) {
                    const telMatch = vcard.match(/TEL[^:]*:([\d+\-\s]+)/);
                    const fnMatch = vcard.match(/FN:(.*)/);
                    if (telMatch) {
                        const phone = telMatch[1].replace(/[^0-9+]/g, '');
                        const name = fnMatch ? fnMatch[1].trim() : '';
                        lines.push(name ? `${name},${phone}` : phone);
                    }
                }
                setRawInput(lines.join('\n'));
                setMessage(`📄 Loaded ${lines.length} contacts from VCF file`);
            } else {
                // TXT: one number per line
                setRawInput(text);
                const count = text.split('\n').filter(l => l.trim()).length;
                setMessage(`📄 Loaded ${count} lines from TXT file`);
            }
        };
        reader.readAsText(file);

        // Reset file input
        if (fileRef.current) fileRef.current.value = '';
    };

    const parseInput = (): Contact[] => {
        const lines = rawInput.split('\n').filter((l) => l.trim());
        const parsed: Contact[] = [];
        const numberSequence = buildNumberSequence(lines.length);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(',').map((p) => p.trim());

            let name = '';
            let phone = '';

            if (parts.length >= 2) {
                name = parts[0];
                phone = parts[1].replace(/[^0-9+]/g, '');
            } else {
                phone = parts[0].replace(/[^0-9+]/g, '');
            }

            if (phone.length < 8) continue;

            if (namePrefix.trim() && (!name || name === phone)) {
                const num = numberSequence[i] ?? (startNumber + i);
                name = `${namePrefix.trim()}${num}`;
            } else if (!name) {
                name = `Contact ${phone.slice(-4)}`;
            }

            parsed.push({ name, phone });
        }

        return parsed;
    };

    const handleGenerate = () => {
        const parsed = parseInput();
        setContacts(parsed);
        setMessage(`✅ Generated ${parsed.length} contacts`);

        // Auto-split if in split mode
        if (activeTab === 'split' && parsed.length > 0) {
            splitContacts(parsed);
        }
    };

    const splitContacts = (contactList?: Contact[]) => {
        const list = contactList || contacts;
        if (list.length === 0) {
            setMessage('⚠️ Generate contacts dulu!');
            return;
        }

        const chunks: Contact[][] = [];
        for (let i = 0; i < list.length; i += splitSize) {
            chunks.push(list.slice(i, i + splitSize));
        }
        setBatches(chunks);
        setMessage(`✅ Split into ${chunks.length} batch(es), each up to ${splitSize} contacts`);
    };

    const buildNumberSequence = (totalContacts: number): number[] => {
        const numbers: number[] = [];
        const ranges: Array<{ from: number; to: number | null }> = [];

        if (continueFrom.trim()) {
            const parts = continueFrom.split(',').map(p => p.trim()).filter(Boolean);
            for (const part of parts) {
                if (part.includes('-')) {
                    const [from, to] = part.split('-').map(s => parseInt(s.trim()));
                    if (!isNaN(from)) {
                        ranges.push({ from, to: !isNaN(to) ? to : null });
                    }
                } else {
                    const num = parseInt(part);
                    if (!isNaN(num)) {
                        ranges.push({ from: num, to: null });
                    }
                }
            }
        }

        let current = startNumber;
        let contactIndex = 0;

        if (ranges.length === 0) {
            for (let i = 0; i < totalContacts; i++) {
                numbers.push(startNumber + i);
            }
        } else {
            const firstContinue = ranges[0].from;
            while (contactIndex < totalContacts && current < firstContinue) {
                numbers.push(current);
                current++;
                contactIndex++;
            }

            for (let r = 0; r < ranges.length && contactIndex < totalContacts; r++) {
                current = ranges[r].from;
                const endAt = ranges[r].to;
                const nextStart = r + 1 < ranges.length ? ranges[r + 1].from : null;

                if (endAt !== null) {
                    while (contactIndex < totalContacts && current <= endAt) {
                        numbers.push(current);
                        current++;
                        contactIndex++;
                    }
                } else if (nextStart !== null) {
                    while (contactIndex < totalContacts && current < nextStart) {
                        numbers.push(current);
                        current++;
                        contactIndex++;
                    }
                } else {
                    while (contactIndex < totalContacts) {
                        numbers.push(current);
                        current++;
                        contactIndex++;
                    }
                }
            }
        }

        return numbers;
    };

    const generateVCFContent = (contactList: Contact[]): string => {
        let vcf = '';
        for (const c of contactList) {
            vcf += `BEGIN:VCARD\r\n`;
            vcf += `VERSION:3.0\r\n`;
            vcf += `FN:${c.name}\r\n`;
            vcf += `N:${c.name};;;;\r\n`;
            vcf += `TEL;TYPE=CELL:${c.phone}\r\n`;
            vcf += `END:VCARD\r\n`;
        }
        return vcf;
    };

    const downloadVCF = async (contactList?: Contact[], filename?: string) => {
        const list = contactList || contacts;
        if (list.length === 0) {
            setMessage('⚠️ Generate contacts dulu sebelum download!');
            return;
        }

        const vcf = generateVCFContent(list);
        const blob = new Blob([vcf], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `contacts_${namePrefix || 'export'}_${Date.now()}.vcf`;
        a.click();
        URL.revokeObjectURL(url);
        if (!contactList) setMessage('✅ VCF file downloaded!');
    };

    const downloadAllBatches = () => {
        batches.forEach((batch, i) => {
            setTimeout(() => {
                downloadVCF(batch, `${namePrefix || 'contacts'}_batch${i + 1}.vcf`);
            }, i * 300);
        });
        setMessage(`✅ Downloading ${batches.length} VCF files...`);
    };

    const copyBatchPhones = (batch: Contact[]) => {
        const text = batch.map(c => c.phone).join('\n');
        navigator.clipboard.writeText(text);
        setMessage('📋 Phone numbers copied!');
    };

    const copyBatchNamesPhones = (batch: Contact[]) => {
        const text = batch.map(c => `${c.name},${c.phone}`).join('\n');
        navigator.clipboard.writeText(text);
        setMessage('📋 Names & phones copied!');
    };

    const inputLineCount = rawInput.split('\n').filter(l => l.trim()).length;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">VCF Converter & Splitter</h1>
                <p className="page-subtitle">Convert, rename, and split phone contacts</p>
            </div>

            {/* Tab Toggle */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                padding: '4px',
            }}>
                <button
                    onClick={() => setActiveTab('convert')}
                    style={{
                        flex: 1,
                        padding: '12px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        background: activeTab === 'convert' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'convert' ? '#000' : 'var(--text-secondary)',
                    }}
                >
                    🏷️ Convert & Rename
                </button>
                <button
                    onClick={() => setActiveTab('split')}
                    style={{
                        flex: 1,
                        padding: '12px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        background: activeTab === 'split' ? 'var(--accent)' : 'transparent',
                        color: activeTab === 'split' ? '#000' : 'var(--text-secondary)',
                    }}
                >
                    ✂️ Auto Split
                </button>
            </div>

            {/* Name Prefix Settings */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div className="card-title">🏷️ Contact Name Settings</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nama Prefix *</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="Contoh: FALO"
                            value={namePrefix}
                            onChange={(e) => setNamePrefix(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px' }}
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mulai dari</label>
                        <input
                            className="input"
                            type="number"
                            min={1}
                            value={startNumber}
                            onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ width: '100%', padding: '12px 16px' }}
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Lanjut dari (opsional)</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="Contoh: 200 atau 200-350"
                            value={continueFrom}
                            onChange={(e) => setContinueFrom(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px' }}
                        />
                    </div>
                </div>

                {namePrefix && (
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                    }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>📋 Preview penamaan:</div>
                        <div style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
                            {buildNumberSequence(6).map((n, i, arr) => (
                                <span key={i}>
                                    <strong>{namePrefix}{n}</strong>
                                    {i < arr.length - 1 ? ', ' : ''}
                                </span>
                            ))}
                            <span style={{ color: 'var(--text-muted)' }}> ...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Phone Numbers Input */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <div>
                        <div className="card-title">📱 Input Contacts</div>
                        <div className="card-subtitle">Paste nomor HP atau upload file TXT/VCF</div>
                    </div>
                    <div style={{
                        background: 'var(--bg-tertiary)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--accent)',
                    }}>
                        📊 {inputLineCount} nomor
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <textarea
                        className="form-textarea"
                        placeholder={`6281234567890\n6289876543210\n6285551234567\n\natau format:\nJohn, 6281234567890`}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        style={{ minHeight: '160px', fontFamily: 'monospace' }}
                    />
                </div>

                {/* Split settings (only in split tab) */}
                {activeTab === 'split' && (
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-end',
                        marginBottom: '16px',
                        padding: '16px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                    }}>
                        <div className="form-group" style={{ margin: 0, flex: '0 0 200px' }}>
                            <label className="form-label">✂️ Split per batch</label>
                            <select
                                className="input"
                                value={splitSize}
                                onChange={(e) => setSplitSize(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                }}
                            >
                                {[25, 50, 100, 150, 200, 250, 300, 500, 1000].map((n) => (
                                    <option key={n} value={n}>{n} kontak/batch</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {inputLineCount > 0 && (
                                <span>
                                    Estimasi: <strong style={{ color: 'var(--accent)' }}>
                                        {Math.ceil(inputLineCount / splitSize)} batch
                                    </strong> ({inputLineCount} kontak ÷ {splitSize})
                                </span>
                            )}
                        </div>
                    </div>
                )}

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
                    <button className="btn btn-primary" onClick={handleGenerate}>
                        ⚡ Generate {activeTab === 'split' ? '& Split' : 'Contacts'}
                    </button>
                    {activeTab === 'convert' && (
                        <button
                            className="btn btn-primary"
                            onClick={() => downloadVCF()}
                            disabled={contacts.length === 0 || loading}
                            style={{ background: contacts.length > 0 ? 'var(--accent)' : undefined }}
                        >
                            {loading ? <span className="spinner" /> : '📥 Download VCF'}
                        </button>
                    )}
                    {message && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{message}</span>
                    )}
                </div>
            </div>

            {/* === CONVERT TAB: Preview Table === */}
            {activeTab === 'convert' && contacts.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Preview ({contacts.length} contacts)</div>
                    </div>
                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contacts.map((c, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{c.name}</td>
                                        <td>
                                            <code style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                                                {c.phone}
                                            </code>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* === SPLIT TAB: Batch Results === */}
            {activeTab === 'split' && batches.length > 0 && (
                <div>
                    {/* Summary bar */}
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                        }}>
                            <div>
                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    Total: <strong style={{ color: 'var(--text-primary)' }}>{contacts.length}</strong> kontak →
                                    <strong style={{ color: 'var(--accent)' }}> {batches.length}</strong> batch
                                    (@ {splitSize}/batch)
                                </span>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={downloadAllBatches}
                            >
                                📥 Download All Batches ({batches.length} VCF)
                            </button>
                        </div>
                    </div>

                    {/* Individual batches */}
                    {batches.map((batch, batchIndex) => (
                        <div key={batchIndex} className="card" style={{ marginBottom: '16px' }}>
                            <div className="card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span className="badge badge-info" style={{ fontSize: '13px', padding: '6px 14px' }}>
                                        Batch {batchIndex + 1}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        {batch.length} kontak
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                        ({batch[0]?.name} — {batch[batch.length - 1]?.name})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => copyBatchPhones(batch)}
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                        title="Copy phone numbers"
                                    >
                                        📋 Copy Nomor
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => copyBatchNamesPhones(batch)}
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                        title="Copy names + phones"
                                    >
                                        📋 Copy All
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => downloadVCF(batch, `${namePrefix || 'contacts'}_batch${batchIndex + 1}.vcf`)}
                                        style={{ fontSize: '12px', padding: '6px 12px' }}
                                    >
                                        📥 VCF
                                    </button>
                                </div>
                            </div>
                            <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>#</th>
                                            <th>Name</th>
                                            <th>Phone</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batch.map((c, i) => (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--text-muted)' }}>
                                                    {batchIndex * splitSize + i + 1}
                                                </td>
                                                <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{c.name}</td>
                                                <td>
                                                    <code style={{
                                                        color: 'var(--text-muted)',
                                                        background: 'var(--bg-tertiary)',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                    }}>
                                                        {c.phone}
                                                    </code>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

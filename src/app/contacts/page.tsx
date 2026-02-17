'use client';

import { useState, useRef } from 'react';

// Country code lookup table (sorted by prefix length descending for accurate matching)
const COUNTRY_CODES: Array<{ prefix: string; country: string; flag: string }> = [
    // 3-digit codes
    { prefix: '233', country: 'Ghana', flag: '🇬🇭' },
    { prefix: '234', country: 'Nigeria', flag: '🇳🇬' },
    { prefix: '254', country: 'Kenya', flag: '🇰🇪' },
    { prefix: '255', country: 'Tanzania', flag: '🇹🇿' },
    { prefix: '256', country: 'Uganda', flag: '🇺🇬' },
    { prefix: '237', country: 'Cameroon', flag: '🇨🇲' },
    { prefix: '250', country: 'Rwanda', flag: '🇷🇼' },
    { prefix: '260', country: 'Zambia', flag: '🇿🇲' },
    { prefix: '263', country: 'Zimbabwe', flag: '🇿🇼' },
    { prefix: '251', country: 'Ethiopia', flag: '🇪🇹' },
    { prefix: '252', country: 'Somalia', flag: '🇸🇴' },
    { prefix: '212', country: 'Morocco', flag: '🇲🇦' },
    { prefix: '213', country: 'Algeria', flag: '🇩🇿' },
    { prefix: '216', country: 'Tunisia', flag: '🇹🇳' },
    { prefix: '218', country: 'Libya', flag: '🇱🇾' },
    { prefix: '220', country: 'Gambia', flag: '🇬🇲' },
    { prefix: '221', country: 'Senegal', flag: '🇸🇳' },
    { prefix: '225', country: 'Ivory Coast', flag: '🇨🇮' },
    { prefix: '227', country: 'Niger', flag: '🇳🇪' },
    { prefix: '228', country: 'Togo', flag: '🇹🇬' },
    { prefix: '229', country: 'Benin', flag: '🇧🇯' },
    { prefix: '230', country: 'Mauritius', flag: '🇲🇺' },
    { prefix: '231', country: 'Liberia', flag: '🇱🇷' },
    { prefix: '232', country: 'Sierra Leone', flag: '🇸🇱' },
    { prefix: '235', country: 'Chad', flag: '🇹🇩' },
    { prefix: '236', country: 'C. African Rep.', flag: '🇨🇫' },
    { prefix: '238', country: 'Cape Verde', flag: '🇨🇻' },
    { prefix: '239', country: 'São Tomé', flag: '🇸🇹' },
    { prefix: '240', country: 'Eq. Guinea', flag: '🇬🇶' },
    { prefix: '241', country: 'Gabon', flag: '🇬🇦' },
    { prefix: '242', country: 'Congo', flag: '🇨🇬' },
    { prefix: '243', country: 'DR Congo', flag: '🇨🇩' },
    { prefix: '244', country: 'Angola', flag: '🇦🇴' },
    { prefix: '245', country: 'Guinea-Bissau', flag: '🇬🇼' },
    { prefix: '246', country: 'Diego Garcia', flag: '🇮🇴' },
    { prefix: '247', country: 'Ascension', flag: '🇦🇨' },
    { prefix: '248', country: 'Seychelles', flag: '🇸🇨' },
    { prefix: '249', country: 'Sudan', flag: '🇸🇩' },
    { prefix: '257', country: 'Burundi', flag: '🇧🇮' },
    { prefix: '258', country: 'Mozambique', flag: '🇲🇿' },
    { prefix: '261', country: 'Madagascar', flag: '🇲🇬' },
    { prefix: '262', country: 'Reunion', flag: '🇷🇪' },
    { prefix: '264', country: 'Namibia', flag: '🇳🇦' },
    { prefix: '265', country: 'Malawi', flag: '🇲🇼' },
    { prefix: '266', country: 'Lesotho', flag: '🇱🇸' },
    { prefix: '267', country: 'Botswana', flag: '🇧🇼' },
    { prefix: '268', country: 'Eswatini', flag: '🇸🇿' },
    { prefix: '269', country: 'Comoros', flag: '🇰🇲' },
    // Asia
    { prefix: '880', country: 'Bangladesh', flag: '🇧🇩' },
    { prefix: '886', country: 'Taiwan', flag: '🇹🇼' },
    { prefix: '855', country: 'Cambodia', flag: '🇰🇭' },
    { prefix: '856', country: 'Laos', flag: '🇱🇦' },
    { prefix: '852', country: 'Hong Kong', flag: '🇭🇰' },
    { prefix: '853', country: 'Macau', flag: '🇲🇴' },
    { prefix: '960', country: 'Maldives', flag: '🇲🇻' },
    { prefix: '961', country: 'Lebanon', flag: '🇱🇧' },
    { prefix: '962', country: 'Jordan', flag: '🇯🇴' },
    { prefix: '963', country: 'Syria', flag: '🇸🇾' },
    { prefix: '964', country: 'Iraq', flag: '🇮🇶' },
    { prefix: '965', country: 'Kuwait', flag: '🇰🇼' },
    { prefix: '966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { prefix: '967', country: 'Yemen', flag: '🇾🇪' },
    { prefix: '968', country: 'Oman', flag: '🇴🇲' },
    { prefix: '971', country: 'UAE', flag: '🇦🇪' },
    { prefix: '972', country: 'Israel', flag: '🇮🇱' },
    { prefix: '973', country: 'Bahrain', flag: '🇧🇭' },
    { prefix: '974', country: 'Qatar', flag: '🇶🇦' },
    { prefix: '975', country: 'Bhutan', flag: '🇧🇹' },
    { prefix: '976', country: 'Mongolia', flag: '🇲🇳' },
    { prefix: '977', country: 'Nepal', flag: '🇳🇵' },
    { prefix: '992', country: 'Tajikistan', flag: '🇹🇯' },
    { prefix: '993', country: 'Turkmenistan', flag: '🇹🇲' },
    { prefix: '994', country: 'Azerbaijan', flag: '🇦🇿' },
    { prefix: '995', country: 'Georgia', flag: '🇬🇪' },
    { prefix: '996', country: 'Kyrgyzstan', flag: '🇰🇬' },
    { prefix: '998', country: 'Uzbekistan', flag: '🇺🇿' },
    // Americas
    { prefix: '502', country: 'Guatemala', flag: '🇬🇹' },
    { prefix: '503', country: 'El Salvador', flag: '🇸🇻' },
    { prefix: '504', country: 'Honduras', flag: '🇭🇳' },
    { prefix: '505', country: 'Nicaragua', flag: '🇳🇮' },
    { prefix: '506', country: 'Costa Rica', flag: '🇨🇷' },
    { prefix: '507', country: 'Panama', flag: '🇵🇦' },
    { prefix: '509', country: 'Haiti', flag: '🇭🇹' },
    { prefix: '591', country: 'Bolivia', flag: '🇧🇴' },
    { prefix: '592', country: 'Guyana', flag: '🇬🇾' },
    { prefix: '593', country: 'Ecuador', flag: '🇪🇨' },
    { prefix: '595', country: 'Paraguay', flag: '🇵🇾' },
    { prefix: '597', country: 'Suriname', flag: '🇸🇷' },
    { prefix: '598', country: 'Uruguay', flag: '🇺🇾' },
    // Europe
    { prefix: '351', country: 'Portugal', flag: '🇵🇹' },
    { prefix: '352', country: 'Luxembourg', flag: '🇱🇺' },
    { prefix: '353', country: 'Ireland', flag: '🇮🇪' },
    { prefix: '354', country: 'Iceland', flag: '🇮🇸' },
    { prefix: '355', country: 'Albania', flag: '🇦🇱' },
    { prefix: '356', country: 'Malta', flag: '🇲🇹' },
    { prefix: '357', country: 'Cyprus', flag: '🇨🇾' },
    { prefix: '358', country: 'Finland', flag: '🇫🇮' },
    { prefix: '359', country: 'Bulgaria', flag: '🇧🇬' },
    { prefix: '370', country: 'Lithuania', flag: '🇱🇹' },
    { prefix: '371', country: 'Latvia', flag: '🇱🇻' },
    { prefix: '372', country: 'Estonia', flag: '🇪🇪' },
    { prefix: '373', country: 'Moldova', flag: '🇲🇩' },
    { prefix: '374', country: 'Armenia', flag: '🇦🇲' },
    { prefix: '375', country: 'Belarus', flag: '🇧🇾' },
    { prefix: '376', country: 'Andorra', flag: '🇦🇩' },
    { prefix: '380', country: 'Ukraine', flag: '🇺🇦' },
    { prefix: '381', country: 'Serbia', flag: '🇷🇸' },
    { prefix: '385', country: 'Croatia', flag: '🇭🇷' },
    { prefix: '386', country: 'Slovenia', flag: '🇸🇮' },
    { prefix: '387', country: 'Bosnia', flag: '🇧🇦' },
    { prefix: '389', country: 'N. Macedonia', flag: '🇲🇰' },
    { prefix: '420', country: 'Czech Rep.', flag: '🇨🇿' },
    { prefix: '421', country: 'Slovakia', flag: '🇸🇰' },
    // 2-digit codes
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
    { prefix: '93', country: 'Afghanistan', flag: '🇦🇫' },
    { prefix: '94', country: 'Sri Lanka', flag: '🇱🇰' },
    { prefix: '95', country: 'Myanmar', flag: '🇲🇲' },
    { prefix: '98', country: 'Iran', flag: '🇮🇷' },
    { prefix: '90', country: 'Turkey', flag: '🇹🇷' },
    { prefix: '20', country: 'Egypt', flag: '🇪🇬' },
    { prefix: '27', country: 'South Africa', flag: '🇿🇦' },
    { prefix: '30', country: 'Greece', flag: '🇬🇷' },
    { prefix: '31', country: 'Netherlands', flag: '🇳🇱' },
    { prefix: '32', country: 'Belgium', flag: '🇧🇪' },
    { prefix: '33', country: 'France', flag: '🇫🇷' },
    { prefix: '34', country: 'Spain', flag: '🇪🇸' },
    { prefix: '36', country: 'Hungary', flag: '🇭🇺' },
    { prefix: '39', country: 'Italy', flag: '🇮🇹' },
    { prefix: '40', country: 'Romania', flag: '🇷🇴' },
    { prefix: '41', country: 'Switzerland', flag: '🇨🇭' },
    { prefix: '43', country: 'Austria', flag: '🇦🇹' },
    { prefix: '44', country: 'UK', flag: '🇬🇧' },
    { prefix: '45', country: 'Denmark', flag: '🇩🇰' },
    { prefix: '46', country: 'Sweden', flag: '🇸🇪' },
    { prefix: '47', country: 'Norway', flag: '🇳🇴' },
    { prefix: '48', country: 'Poland', flag: '🇵🇱' },
    { prefix: '49', country: 'Germany', flag: '🇩🇪' },
    { prefix: '51', country: 'Peru', flag: '🇵🇪' },
    { prefix: '52', country: 'Mexico', flag: '🇲🇽' },
    { prefix: '53', country: 'Cuba', flag: '🇨🇺' },
    { prefix: '54', country: 'Argentina', flag: '🇦🇷' },
    { prefix: '55', country: 'Brazil', flag: '🇧🇷' },
    { prefix: '56', country: 'Chile', flag: '🇨🇱' },
    { prefix: '57', country: 'Colombia', flag: '🇨🇴' },
    { prefix: '58', country: 'Venezuela', flag: '🇻🇪' },
    // 1-digit codes
    { prefix: '1', country: 'USA/Canada', flag: '🇺🇸' },
    { prefix: '7', country: 'Russia', flag: '🇷🇺' },
];

function detectCountry(phone: string): { country: string; flag: string } | null {
    const clean = phone.replace(/^\+/, '');
    // Try 3-digit, then 2-digit, then 1-digit prefixes
    for (const cc of COUNTRY_CODES) {
        if (clean.startsWith(cc.prefix)) {
            return { country: cc.country, flag: cc.flag };
        }
    }
    return null;
}

interface Contact {
    name: string;
    phone: string;
    country?: string;
    flag?: string;
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

            const detected = detectCountry(phone);
            parsed.push({ name, phone, country: detected?.country, flag: detected?.flag });
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
                    {/* Country Stats */}
                    {(() => {
                        const countryStats: Record<string, { flag: string; count: number }> = {};
                        let unknownCount = 0;
                        contacts.forEach(c => {
                            if (c.country && c.flag) {
                                if (!countryStats[c.country]) countryStats[c.country] = { flag: c.flag, count: 0 };
                                countryStats[c.country].count++;
                            } else {
                                unknownCount++;
                            }
                        });
                        const entries = Object.entries(countryStats).sort((a, b) => b[1].count - a[1].count);
                        if (entries.length === 0) return null;
                        return (
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px',
                                background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '12px'
                            }}>
                                {entries.map(([country, { flag, count }]) => (
                                    <span key={country} style={{
                                        fontSize: '12px', padding: '4px 10px',
                                        background: 'var(--bg-secondary)', borderRadius: '20px',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {flag} {country}: <strong style={{ color: 'var(--accent)' }}>{count}</strong>
                                    </span>
                                ))}
                                {unknownCount > 0 && (
                                    <span style={{
                                        fontSize: '12px', padding: '4px 10px',
                                        background: 'var(--bg-secondary)', borderRadius: '20px',
                                        color: 'var(--text-muted)'
                                    }}>
                                        ❓ Unknown: <strong>{unknownCount}</strong>
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Country</th>
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
                                        <td style={{ fontSize: '13px' }}>
                                            {c.flag ? `${c.flag} ${c.country}` : <span style={{ color: 'var(--text-muted)' }}>❓</span>}
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

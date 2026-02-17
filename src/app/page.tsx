'use client';

import { useEffect, useState } from 'react';

interface Stats {
  groups: number;
  contacts: number;
  broadcasts: number;
  status: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    groups: 0,
    contacts: 0,
    broadcasts: 0,
    status: 'disconnected',
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/wa/status');
        if (res.ok) {
          const data = await res.json();
          let isConnected = false;
          let groupsCount = 0;

          // Handle new multi-profile format
          if (data.profiles && Array.isArray(data.profiles)) {
            isConnected = data.profiles.some((p: any) => p.status === 'connected');
            // Sum up groupsCount from all connected profiles
            groupsCount = data.profiles.reduce((sum: number, p: any) => sum + (p.groupsCount || 0), 0);
          } else if (data.status) {
            isConnected = data.status === 'connected';
            groupsCount = data.groupsCount || 0;
          }

          setStats((prev) => ({ ...prev, status: isConnected ? 'connected' : 'disconnected', groups: groupsCount }));

          // If connected but groupsCount is 0, try fetching from groups API
          if (isConnected && groupsCount === 0) {
            try {
              const gRes = await fetch('/api/groups?profileId=1');
              if (gRes.ok) {
                const gData = await gRes.json();
                if (gData.groups) {
                  setStats((prev) => ({ ...prev, groups: gData.groups.length }));
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome to WA Group Manager — your all-in-one WhatsApp tool</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon green">📱</div>
          <div className="stat-value">{stats.status === 'connected' ? '✓' : '✗'}</div>
          <div className="stat-label">WhatsApp Connection</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">👥</div>
          <div className="stat-value">{stats.groups}</div>
          <div className="stat-label">Groups Managed</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">📇</div>
          <div className="stat-value">{stats.contacts}</div>
          <div className="stat-label">Contacts</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">📢</div>
          <div className="stat-value">{stats.broadcasts}</div>
          <div className="stat-label">Broadcasts Sent</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Quick Start Guide</div>
            <div className="card-subtitle">Get up and running in minutes</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <QuickStep
            num={1}
            title="Connect WhatsApp"
            desc="Go to WA Connection page and scan the QR code with your phone."
            href="/auth"
          />
          <QuickStep
            num={2}
            title="Manage Contacts"
            desc="Convert phone numbers to VCF files or sync with Google Contacts."
            href="/contacts"
          />
          <QuickStep
            num={3}
            title="Create Groups"
            desc="Upload a TXT file to auto-create WhatsApp groups in bulk."
            href="/groups/create"
          />
          <QuickStep
            num={4}
            title="Broadcast Messages"
            desc="Send messages to multiple groups with smart random delays."
            href="/broadcast"
          />
        </div>
      </div>
    </div>
  );
}

function QuickStep({ num, title, desc, href }: { num: number; title: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '16px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        border: '1px solid var(--border)',
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)';
        (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: '700',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <div>
        <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '14px' }}>{title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{desc}</div>
      </div>
    </a>
  );
}

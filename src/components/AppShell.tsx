'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (isLoginPage) {
        return (
            <div className="app-layout">
                <main className="main-content" style={{ marginLeft: 0 }}>
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <button
                className="mobile-menu-btn"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Toggle Menu"
            >
                ☰
            </button>

            <main className="main-content fade-in">
                {children}
            </main>
        </div>
    );
}

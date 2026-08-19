'use client';

import { useState, ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './sidebar';

interface AppShellProps {
  children: ReactNode;
}

/// Casca de layout de toda tela autenticada. Desktop: sidebar fixa.
/// Telas menores: sidebar vira menu recolhível (brief de design —
/// "abordagem responsiva desde o início"), sem duas interfaces
/// diferentes, só o mesmo componente reagindo ao breakpoint.
export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-foreground hover:bg-muted"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="ml-2 text-sm font-medium text-foreground">Wave Burger</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

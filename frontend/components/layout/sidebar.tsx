'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Wheat,
  Boxes,
  ShoppingCart,
  ReceiptText,
  Truck,
  Wallet,
  BarChart3,
  Users,
  History,
  Settings,
  Flame,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/// Estrutura de navegação aprovada em 19/08/2026. Agrupar em
/// Operação/Gestão/Sistema reduz a sensação de complexidade em vez de
/// 15 itens soltos — mesmo princípio usado nas 6 telas principais do
/// roadmap (Dashboard, Produtos, Ficha Técnica, Estoque, Compras,
/// Financeiro).
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Produtos', href: '/products', icon: Package },
      { label: 'Ingredientes', href: '/ingredients', icon: Wheat },
      { label: 'Estoque', href: '/stock', icon: Boxes },
      { label: 'Compras', href: '/purchases', icon: ShoppingCart },
      { label: 'Vendas', href: '/sales', icon: ReceiptText },
      { label: 'Fornecedores', href: '/suppliers', icon: Truck },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Financeiro', href: '/financial', icon: Wallet },
      { label: 'BI / Indicadores', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Usuários', href: '/users', icon: Users },
      { label: 'Auditoria', href: '/audit', icon: History },
      { label: 'Configurações', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="flex h-full w-56 flex-col bg-sidebar px-3 py-5" aria-label="Navegação principal">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2" onClick={onNavigate}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
          <Flame className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-medium text-white">Wave Burger</span>
      </Link>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group, idx) => (
          <div key={group.label ?? `group-${idx}`}>
            {group.label && (
              <p className="mb-1.5 px-2 text-xs font-medium text-sidebar-muted">{group.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-sidebar-muted hover:bg-white/5 hover:text-white',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {user && (
        <div className="mt-4 flex items-center gap-2 border-t border-white/10 px-2 pt-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
            {user.name
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user.name}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-md p-1.5 text-sidebar-muted hover:bg-white/5 hover:text-white"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}

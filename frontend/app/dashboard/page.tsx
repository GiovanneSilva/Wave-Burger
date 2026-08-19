'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { useAuth } from '@/components/auth/auth-provider';

/// Placeholder mínimo — só para o login ter um destino real. O
/// dashboard executivo de verdade (RF-025, KPIs, alertas, produtos mais
/// lucrativos) é escopo de uma etapa separada.
export default function DashboardPage() {
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={
          loading ? 'Carregando…' : user ? `Bem-vindo(a), ${user.name.split(' ')[0]}.` : undefined
        }
      />
      <p className="text-sm text-muted-foreground">
        O dashboard executivo completo (faturamento, CMV, alertas, produtos mais lucrativos) ainda não
        foi implementado — essa é a próxima tela real do roadmap.
      </p>
    </AppShell>
  );
}

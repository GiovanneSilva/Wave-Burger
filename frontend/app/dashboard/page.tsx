'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { KpiCard } from '@/components/wave/kpi-card';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth/auth-provider';
import { formatPercentage } from '@/lib/format';
import type { ExecutiveDashboard, CriticalStockItem, DeliverableQuantity } from '@/lib/types';

function last30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useAuth();

  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [criticalStock, setCriticalStock] = useState<CriticalStockItem[] | null>(null);
  const [deliverable, setDeliverable] = useState<DeliverableQuantity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.businessUnitId) return;

    const { from, to } = last30Days();
    const params = `businessUnitId=${user.businessUnitId}&from=${from}&to=${to}`;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/analytics/executive?${params}`).then((res) =>
        res.ok ? (res.json() as Promise<ExecutiveDashboard>) : Promise.reject(res),
      ),
      // Estoque crítico depende de stock:read — pode não estar disponível
      // para todo perfil (ex.: FINANCE). Falha aqui não deve derrubar o
      // resto do dashboard.
      fetch(`/api/stock/below-minimum?businessUnitId=${user.businessUnitId}`)
        .then((res) => (res.ok ? (res.json() as Promise<CriticalStockItem[]>) : null))
        .catch(() => null),
      fetch(`/api/analytics/deliverable-quantities?businessUnitId=${user.businessUnitId}`)
        .then((res) => (res.ok ? (res.json() as Promise<DeliverableQuantity[]>) : null))
        .catch(() => null),
    ])
      .then(([exec, stock, deliverableQuantities]) => {
        setDashboard(exec);
        setCriticalStock(stock);
        setDeliverable(deliverableQuantities);
      })
      .catch(() => setError('Não foi possível carregar os indicadores. Verifique se a API está no ar.'))
      .finally(() => setLoading(false));
  }, [user?.businessUnitId]);

  if (userLoading || loading) {
    return (
      <AppShell>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
      </AppShell>
    );
  }

  if (error || !dashboard) {
    return (
      <AppShell>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Não foi possível carregar o dashboard"
          description={error ?? 'Tente novamente em alguns instantes.'}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={`Últimos 30 dias${user ? ` · ${user.name.split(' ')[0]}` : ''}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Faturamento" value={<MoneyValue value={dashboard.faturamento} />} />
        <KpiCard label="CMV" value={<MoneyValue value={dashboard.cmv} />} />
        <KpiCard
          label="Margem bruta"
          value={dashboard.margemBruta !== null ? formatPercentage(dashboard.margemBruta) : '—'}
        />
        <KpiCard
          label="Resultado operacional"
          value={
            <MoneyValue
              value={dashboard.lucroOperacional}
              tone={dashboard.lucroOperacional >= 0 ? 'success' : 'danger'}
            />
          }
        />
      </div>

      {criticalStock && criticalStock.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Atenção</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            {criticalStock.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm text-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <span className="font-medium">{item.ingredient.name}</span> abaixo do estoque mínimo (
                  {item.currentQuantity} / {item.ingredient.minimumStock} {item.ingredient.standardUnit})
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {deliverable && deliverable.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quanto dá pra entregar hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            {deliverable.map((d) => (
              <div key={d.productId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{d.productName}</span>
                <span className="flex items-center gap-2">
                  {d.limitingIngredientName && (
                    <span className="text-xs text-muted-foreground">
                      limitado por {d.limitingIngredientName}
                    </span>
                  )}
                  <span
                    className={`font-medium tabular-nums ${
                      d.deliverableQuantity === 0 ? 'text-danger' : d.deliverableQuantity < 5 ? 'text-warning' : 'text-foreground'
                    }`}
                  >
                    {d.deliverableQuantity} un.
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Produtos mais lucrativos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {dashboard.produtosMaisLucrativos.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="Nenhum produto ativo com ficha técnica ainda"
              description="Assim que houver produtos ativos com ficha técnica válida, o ranking aparece aqui."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {dashboard.produtosMaisLucrativos.map((p, i) => (
                <div key={p.productId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {p.productName}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {p.marginPercentage !== null && (
                      <span className="text-muted-foreground">{formatPercentage(p.marginPercentage)}</span>
                    )}
                    {p.estimatedProfit !== null && <MoneyValue value={p.estimatedProfit} tone="success" />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{dashboard.indicadoresNaoDisponiveis}</p>
    </AppShell>
  );
}

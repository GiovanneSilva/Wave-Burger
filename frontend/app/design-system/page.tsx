'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { KpiCard } from '@/components/wave/kpi-card';
import { StatusBadge, PRODUCT_STATUS_MAP } from '@/components/wave/status-badge';
import { StockStatus } from '@/components/wave/stock-status';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { AuditTimeline } from '@/components/wave/audit-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, Inbox } from 'lucide-react';

interface SampleProduct {
  id: string;
  name: string;
  cost: number;
  price: number;
  cmv: number;
  margin: number;
  status: string;
}

const sampleProducts: SampleProduct[] = [
  { id: '1', name: 'Wave Smash', cost: 10.77, price: 32.9, cmv: 32.7, margin: 67.3, status: 'ACTIVE' },
  { id: '2', name: 'Wave Bacon', cost: 13.4, price: 36.9, cmv: 36.3, margin: 63.7, status: 'ACTIVE' },
  { id: '3', name: 'Wave Chicken', cost: 11.2, price: 31.9, cmv: 35.1, margin: 64.9, status: 'DRAFT' },
];

const productColumns: DataTableColumn<SampleProduct>[] = [
  { key: 'name', header: 'Produto', render: (p) => p.name },
  { key: 'cost', header: 'Custo', align: 'right', render: (p) => <MoneyValue value={p.cost} /> },
  { key: 'price', header: 'Venda', align: 'right', render: (p) => <MoneyValue value={p.price} /> },
  { key: 'cmv', header: 'CMV', align: 'right', render: (p) => `${p.cmv.toFixed(1)}%` },
  { key: 'margin', header: 'Margem', align: 'right', render: (p) => `${p.margin.toFixed(1)}%` },
  {
    key: 'status',
    header: 'Status',
    render: (p) => {
      const s = PRODUCT_STATUS_MAP[p.status];
      return <StatusBadge label={s.label} tone={s.tone} />;
    },
  },
];

const sampleAudit = [
  { id: '1', action: 'CREATE_VERSION', userName: 'Admin', createdAt: '2026-08-19T14:30:00Z' },
  { id: '2', action: 'STOCK_ENTRY', userName: 'Admin', createdAt: '2026-08-19T14:00:00Z' },
  { id: '3', action: 'CREATE', userName: 'Admin', createdAt: '2026-08-19T13:00:00Z' },
];

export default function DesignSystemPreviewPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader
        title="Design system"
        description="Prévia dos componentes base do Wave Burger — não é uma tela real."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Ação primária
          </Button>
        }
      />

      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground">KPI cards</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Faturamento" value="R$ 4.820" change={8.2} href="/analytics" />
          <KpiCard label="CMV" value="31,4%" change={2.1} changeInvertColors changeLabel="vs. mês anterior" />
          <KpiCard label="Resultado estimado" value="R$ 1.640" change={-3.5} />
          <KpiCard label="Ticket médio" value="R$ 47,20" />
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <StatusBadge label="Ativo" tone="success" />
            <StatusBadge label="Rascunho" tone="neutral" />
            <StatusBadge label="Inativo" tone="danger" />
            <StatusBadge label="Pendente" tone="warning" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estoque (3 estados)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <StockStatus currentQuantity={18.4} minimumStock={10} />
            <StockStatus currentQuantity={11} minimumStock={10} />
            <StockStatus currentQuantity={0.8} minimumStock={2} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Data table</p>
        <DataTable columns={productColumns} data={sampleProducts} rowKey={(p) => p.id} onRowClick={() => {}} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Empty state</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Inbox className="h-8 w-8" />}
              title="Nenhum produto ainda"
              description="Cadastre seu primeiro produto para começar a montar a ficha técnica."
              action={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Criar produto
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline entries={sampleAudit} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Confirm dialog</p>
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          Abrir diálogo de confirmação
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Inativar produto?"
          description="O Wave Bacon deixará de aparecer para venda. O histórico é mantido."
          confirmLabel="Inativar"
          destructive
          onConfirm={() => setConfirmOpen(false)}
        />
      </div>
    </AppShell>
  );
}

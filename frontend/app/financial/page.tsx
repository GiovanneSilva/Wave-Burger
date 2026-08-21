'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { KpiCard } from '@/components/wave/kpi-card';
import { MoneyValue } from '@/components/wave/money-value';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { StatusBadge, FINANCIAL_ENTRY_STATUS_MAP } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/auth-provider';
import type { FinancialEntry, CashFlowResult, DreResult } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  MATERIA_PRIMA: 'Matéria-prima',
  EMBALAGEM: 'Embalagem',
  MARKETING: 'Marketing',
  ALUGUEL: 'Aluguel',
  ENERGIA: 'Energia',
  PLATAFORMA: 'Plataforma',
  ADMINISTRATIVO: 'Administrativo',
  MANUTENCAO: 'Manutenção',
  VENDAS: 'Vendas',
};

const PAYABLE_CATEGORIES = [
  'MATERIA_PRIMA',
  'EMBALAGEM',
  'MARKETING',
  'ALUGUEL',
  'ENERGIA',
  'PLATAFORMA',
  'ADMINISTRATIVO',
  'MANUTENCAO',
];

function last30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function FinancialPage() {
  const { user } = useAuth();
  const businessUnitId = user?.businessUnitId;

  const [{ from, to }, setRange] = useState(last30Days());
  const [entries, setEntries] = useState<FinancialEntry[] | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowResult | null>(null);
  const [dre, setDre] = useState<DreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [category, setCategory] = useState('MATERIA_PRIMA');
  const [description, setDescription] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toPay, setToPay] = useState<FinancialEntry | null>(null);
  const [paying, setPaying] = useState(false);

  async function load() {
    if (!businessUnitId) return;
    setError(null);

    const params = `businessUnitId=${businessUnitId}&from=${from}&to=${to}`;
    const [entriesRes, cashFlowRes, dreRes] = await Promise.all([
      fetch(`/api/financial/entries?businessUnitId=${businessUnitId}`),
      fetch(`/api/financial/cash-flow?${params}`),
      fetch(`/api/financial/dre?${params}`),
    ]);

    if (!entriesRes.ok) {
      setError('Não foi possível carregar os dados financeiros.');
      return;
    }

    setEntries(await entriesRes.json());
    if (cashFlowRes.ok) setCashFlow(await cashFlowRes.json());
    if (dreRes.ok) setDre(await dreRes.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessUnitId, from, to]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!description || !grossAmount) {
      setFormError('Descrição e valor são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/financial/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessUnitId,
          type,
          category,
          description,
          grossAmount,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível criar o lançamento.' }));
        setFormError(body.message);
        return;
      }

      setDescription('');
      setGrossAmount('');
      setDueDate('');
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handlePayConfirm() {
    if (!toPay) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/financial/entries/${toPay.id}/pay`, { method: 'PATCH' });
      if (res.ok) {
        setToPay(null);
        await load();
      }
    } finally {
      setPaying(false);
    }
  }

  const payables = (entries ?? []).filter((e) => e.type === 'PAYABLE');
  const receivables = (entries ?? []).filter((e) => e.type === 'RECEIVABLE');

  function entryColumns(): DataTableColumn<FinancialEntry>[] {
    return [
      { key: 'description', header: 'Descrição', render: (e) => e.description },
      { key: 'category', header: 'Categoria', render: (e) => CATEGORY_LABELS[e.category] ?? e.category },
      {
        key: 'dueDate',
        header: 'Vencimento',
        render: (e) => (e.dueDate ? new Date(e.dueDate).toLocaleDateString('pt-BR') : '—'),
      },
      { key: 'amount', header: 'Valor', align: 'right', render: (e) => <MoneyValue value={e.grossAmount} /> },
      {
        key: 'status',
        header: 'Status',
        render: (e) => {
          const s = FINANCIAL_ENTRY_STATUS_MAP[e.status];
          return <StatusBadge label={s.label} tone={s.tone} />;
        },
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (e) =>
          e.status === 'PENDING' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                setToPay(e);
              }}
            >
              Marcar como pago
            </Button>
          ) : null,
      },
    ];
  }

  return (
    <AppShell>
      <PageHeader
        title="Financeiro"
        description="Contas a pagar, a receber, fluxo de caixa e DRE gerencial."
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? 'Cancelar' : 'Novo lançamento'}
          </Button>
        }
      />

      <div className="mb-4 flex items-end gap-3">
        <div>
          <Label htmlFor="range-from">De</Label>
          <Input id="range-from" type="date" value={from} onChange={(e) => setRange({ from: e.target.value, to })} />
        </div>
        <div>
          <Label htmlFor="range-to">Até</Label>
          <Input id="range-to" type="date" value={to} onChange={(e) => setRange({ from, to: e.target.value })} />
        </div>
      </div>

      {formOpen && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div>
                <Label htmlFor="fin-type">Tipo</Label>
                <Select id="fin-type" value={type} onChange={(e) => setType(e.target.value as 'PAYABLE' | 'RECEIVABLE')}>
                  <option value="PAYABLE">Conta a pagar</option>
                  <option value="RECEIVABLE">Conta a receber</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="fin-category">Categoria</Label>
                <Select id="fin-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {PAYABLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="fin-description">Descrição</Label>
                <Input
                  id="fin-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Aluguel de agosto"
                />
              </div>
              <div>
                <Label htmlFor="fin-amount">Valor (R$)</Label>
                <Input id="fin-amount" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="fin-due">Vencimento</Label>
                <Input id="fin-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div className="flex items-end gap-2 md:col-span-6">
                {formError && <p className="mr-auto text-sm text-danger">{formError}</p>}
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Criar lançamento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-6" />}

      <Tabs defaultValue="cashflow">
        <TabsList>
          <TabsTrigger value="cashflow">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="payable">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receivable">Contas a receber</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow">
          {cashFlow ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <KpiCard label="Entradas" value={<MoneyValue value={cashFlow.entradas} tone="success" />} />
              <KpiCard label="Saídas" value={<MoneyValue value={cashFlow.saidas} tone="danger" />} />
              <KpiCard
                label="Saldo do período"
                value={<MoneyValue value={cashFlow.saldo} tone={cashFlow.saldo >= 0 ? 'success' : 'danger'} />}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </TabsContent>

        <TabsContent value="payable">
          {payables.length === 0 ? (
            <EmptyState
              title="Nenhuma conta a pagar"
              description="Lançamentos de compras confirmadas aparecem aqui automaticamente."
            />
          ) : (
            <DataTable columns={entryColumns()} data={payables} rowKey={(e) => e.id} />
          )}
        </TabsContent>

        <TabsContent value="receivable">
          {receivables.length === 0 ? (
            <EmptyState
              title="Nenhuma conta a receber"
              description="Lançamentos de vendas registradas aparecem aqui automaticamente."
            />
          ) : (
            <DataTable columns={entryColumns()} data={receivables} rowKey={(e) => e.id} />
          )}
        </TabsContent>

        <TabsContent value="dre">
          {dre ? (
            <Card className="max-w-md">
              <CardContent className="flex flex-col gap-2 pt-5 text-sm">
                <DreRow label="Receita bruta" value={dre.receitaBruta} />
                <DreRow label="(-) Taxas" value={-dre.taxas} />
                <DreRow label="(-) Impostos" value={-dre.impostos} />
                <DreRow label="(-) CMV" value={-dre.cmv} />
                <DreRow label="Lucro bruto" value={dre.lucroBruto} bold border />
                <DreRow label="(-) Despesas operacionais" value={-dre.despesasOperacionais} />
                <DreRow
                  label="Resultado operacional"
                  value={dre.resultadoOperacional}
                  bold
                  border
                  tone={dre.resultadoOperacional >= 0 ? 'success' : 'danger'}
                />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={toPay !== null}
        onOpenChange={(open) => !open && setToPay(null)}
        title="Marcar como pago?"
        description={`"${toPay?.description}" será liquidado com a data de hoje.`}
        confirmLabel="Marcar como pago"
        onConfirm={handlePayConfirm}
        loading={paying}
      />
    </AppShell>
  );
}

function DreRow({
  label,
  value,
  bold,
  border,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  border?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <div
      className={`flex justify-between ${bold ? 'font-medium' : 'text-muted-foreground'} ${
        border ? 'border-t border-border pt-2' : ''
      }`}
    >
      <span>{label}</span>
      <MoneyValue value={value} tone={tone} />
    </div>
  );
}

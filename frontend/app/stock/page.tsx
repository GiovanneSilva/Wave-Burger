'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { StockStatus } from '@/components/wave/stock-status';
import { EmptyState } from '@/components/wave/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth/auth-provider';
import type { StockBalance, StockMovement, Ingredient } from '@/lib/types';

const UNITS = ['kg', 'g', 'l', 'ml', 'un'];

const REASON_LABELS: Record<string, string> = {
  LOSS: 'Perda',
  WASTE: 'Desperdício',
  INVENTORY: 'Inventário',
  CORRECTION: 'Correção',
  RETURN: 'Devolução',
};

const SOURCE_LABELS: Record<string, string> = {
  PURCHASE: 'Compra',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
  SALE: 'Venda',
};

export default function StockPage() {
  const { user } = useAuth();
  const businessUnitId = user?.businessUnitId;

  const [balances, setBalances] = useState<StockBalance[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [reason, setReason] = useState('LOSS');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!businessUnitId) return;
    setError(null);

    const [balancesRes, movementsRes, ingredientsRes] = await Promise.all([
      fetch(`/api/stock/balances?businessUnitId=${businessUnitId}`),
      fetch(`/api/stock/movements?businessUnitId=${businessUnitId}`),
      fetch('/api/ingredients'),
    ]);

    if (!balancesRes.ok) {
      setError('Não foi possível carregar o estoque.');
      return;
    }

    setBalances(await balancesRes.json());
    if (movementsRes.ok) setMovements(await movementsRes.json());
    if (ingredientsRes.ok) {
      const all: Ingredient[] = await ingredientsRes.json();
      setIngredients(all.filter((i) => i.isActive));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessUnitId]);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!ingredientId || !quantity) {
      setFormError('Selecione o ingrediente e informe a quantidade.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/stock/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessUnitId,
          ingredientId,
          direction,
          quantity,
          unit,
          reason,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível registrar o ajuste.' }));
        setFormError(body.message);
        return;
      }

      setIngredientId('');
      setQuantity('');
      setNotes('');
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<StockBalance>[] = [
    { key: 'name', header: 'Ingrediente', render: (b) => <span className="font-medium">{b.ingredient.name}</span> },
    {
      key: 'current',
      header: 'Estoque atual',
      align: 'right',
      render: (b) => `${b.currentQuantity} ${b.ingredient.standardUnit}`,
    },
    {
      key: 'minimum',
      header: 'Mínimo',
      align: 'right',
      render: (b) => (b.ingredient.minimumStock ? `${b.ingredient.minimumStock} ${b.ingredient.standardUnit}` : '—'),
    },
    {
      key: 'status',
      header: 'Situação',
      render: (b) => (
        <StockStatus
          currentQuantity={Number(b.currentQuantity)}
          minimumStock={b.ingredient.minimumStock !== null ? Number(b.ingredient.minimumStock) : null}
        />
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Estoque"
        description="Saldo atual por ingrediente na unidade."
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? 'Cancelar' : 'Novo ajuste'}
          </Button>
        }
      />

      {formOpen && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form onSubmit={handleAdjust} className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label htmlFor="adj-ingredient">Ingrediente</Label>
                <Select id="adj-ingredient" value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="adj-direction">Tipo</Label>
                <Select
                  id="adj-direction"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}
                >
                  <option value="OUT">Saída</option>
                  <option value="IN">Entrada</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="adj-quantity">Quantidade</Label>
                <Input id="adj-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="adj-unit">Unidade</Label>
                <Select id="adj-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="adj-reason">Motivo</Label>
                <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {Object.entries(REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-4">
                <Label htmlFor="adj-notes">Observação (opcional)</Label>
                <Input id="adj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhe o que aconteceu" />
              </div>

              <div className="flex items-end gap-2 md:col-span-2">
                {formError && <p className="mr-auto text-sm text-danger">{formError}</p>}
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Registrar ajuste'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-6" />}

      {balances === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando estoque…</p>
      ) : (
        balances && (
          <DataTable
            columns={columns}
            data={balances}
            rowKey={(b) => b.id}
            emptyTitle="Nenhuma movimentação de estoque ainda"
            emptyDescription="O saldo aparece aqui assim que uma compra for confirmada ou um ajuste for registrado."
          />
        )
      )}

      {movements && movements.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Movimentações recentes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            {movements.slice(0, 10).map((m) => {
              const ingredientName = ingredients.find((i) => i.id === m.ingredientId)?.name ?? m.ingredientId;
              return (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className={m.direction === 'IN' ? 'text-success' : 'text-danger'}>
                      {m.direction === 'IN' ? '+' : '−'}
                    </span>{' '}
                    {m.quantity} {m.unit} · {ingredientName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {SOURCE_LABELS[m.source]}
                      {m.adjustmentReason ? ` — ${REASON_LABELS[m.adjustmentReason]}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { StatusBadge } from '@/components/wave/status-badge';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type { Ingredient } from '@/lib/types';

const UNITS = ['kg', 'g', 'l', 'ml', 'un'];

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [standardUnit, setStandardUnit] = useState('kg');
  const [minimumStock, setMinimumStock] = useState('');
  const [averageCost, setAverageCost] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toToggle, setToToggle] = useState<Ingredient | null>(null);
  const [toggling, setToggling] = useState(false);

  async function load() {
    setError(null);
    const res = await fetch('/api/ingredients');
    if (!res.ok) {
      setError('Não foi possível carregar os ingredientes.');
      return;
    }
    setIngredients(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name || !standardUnit) {
      setFormError('Nome e unidade padrão são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          standardUnit,
          category: category || undefined,
          minimumStock: minimumStock || undefined,
          averageCost: averageCost || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível criar.' }));
        setFormError(body.message);
        return;
      }

      setName('');
      setCategory('');
      setMinimumStock('');
      setAverageCost('');
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleConfirm() {
    if (!toToggle) return;
    setToggling(true);
    try {
      const action = toToggle.isActive ? 'deactivate' : 'activate';
      const res = await fetch(`/api/ingredients/${toToggle.id}/${action}`, { method: 'PATCH' });
      if (res.ok) {
        setToToggle(null);
        await load();
      }
    } finally {
      setToggling(false);
    }
  }

  const columns: DataTableColumn<Ingredient>[] = [
    { key: 'name', header: 'Nome', render: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'category', header: 'Categoria', render: (i) => i.category ?? '—' },
    { key: 'unit', header: 'Unidade', render: (i) => i.standardUnit },
    {
      key: 'minimumStock',
      header: 'Estoque mínimo',
      align: 'right',
      render: (i) => (i.minimumStock ? `${i.minimumStock} ${i.standardUnit}` : '—'),
    },
    {
      key: 'averageCost',
      header: 'Custo médio',
      align: 'right',
      render: (i) => (i.averageCost ? <MoneyValue value={i.averageCost} /> : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <StatusBadge label={i.isActive ? 'Ativo' : 'Inativo'} tone={i.isActive ? 'success' : 'neutral'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setToToggle(i);
          }}
        >
          {i.isActive ? 'Inativar' : 'Ativar'}
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Ingredientes"
        description="Catálogo de matérias-primas — custo e unidade padrão usados na ficha técnica."
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? 'Cancelar' : 'Novo ingrediente'}
          </Button>
        }
      />

      {formOpen && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label htmlFor="ing-name">Nome</Label>
                <Input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Carne Bovina" />
              </div>
              <div>
                <Label htmlFor="ing-category">Categoria</Label>
                <Input id="ing-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="ing-unit">Unidade padrão</Label>
                <Select id="ing-unit" value={standardUnit} onChange={(e) => setStandardUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ing-min">Estoque mínimo</Label>
                <Input id="ing-min" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} placeholder="Opcional" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="ing-cost">Custo médio (R$)</Label>
                <Input id="ing-cost" value={averageCost} onChange={(e) => setAverageCost(e.target.value)} placeholder="Opcional" inputMode="decimal" />
              </div>

              <div className="flex items-end gap-2 md:col-span-5">
                {formError && <p className="mr-auto text-sm text-danger">{formError}</p>}
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Criar ingrediente'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-4" />}

      {ingredients === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando ingredientes…</p>
      ) : (
        ingredients && (
          <DataTable
            columns={columns}
            data={ingredients}
            rowKey={(i) => i.id}
            emptyTitle="Nenhum ingrediente ainda"
            emptyDescription="Cadastre o primeiro ingrediente para começar a montar fichas técnicas."
          />
        )
      )}

      <ConfirmDialog
        open={toToggle !== null}
        onOpenChange={(open) => !open && setToToggle(null)}
        title={toToggle?.isActive ? 'Inativar ingrediente?' : 'Ativar ingrediente?'}
        description={
          toToggle?.isActive
            ? `${toToggle?.name} deixará de poder ser usado em novas fichas técnicas. O histórico é mantido.`
            : `${toToggle?.name} volta a ficar disponível para novas fichas técnicas.`
        }
        confirmLabel={toToggle?.isActive ? 'Inativar' : 'Ativar'}
        destructive={toToggle?.isActive}
        onConfirm={handleToggleConfirm}
        loading={toggling}
      />
    </AppShell>
  );
}

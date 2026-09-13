'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Ingredient } from '@/lib/types';

const UNITS = ['kg', 'g', 'l', 'ml', 'un'];

export default function EditIngredientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ingredientId = params.id;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [standardUnit, setStandardUnit] = useState('kg');
  const [storageLocation, setStorageLocation] = useState('');
  const [minimumStock, setMinimumStock] = useState('');
  const [averageCost, setAverageCost] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [recalculating, setRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/ingredients/${ingredientId}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data: Ingredient = await res.json();
    setIngredient(data);
    setName(data.name);
    setCategory(data.category ?? '');
    setStandardUnit(data.standardUnit);
    setStorageLocation(data.storageLocation ?? '');
    setMinimumStock(data.minimumStock ?? '');
    setAverageCost(data.averageCost ?? '');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    setSaving(true);
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: category || undefined,
          standardUnit,
          storageLocation: storageLocation || undefined,
          minimumStock: minimumStock || undefined,
          averageCost: averageCost || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível salvar.' }));
        setSaveError(body.message);
        return;
      }

      setSaveSuccess(true);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculate() {
    setRecalculateError(null);
    setRecalculating(true);
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}/recalculate-average-cost`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível recalcular.' }));
        setRecalculateError(body.message);
        return;
      }

      const updated: Ingredient = await res.json();
      setAverageCost(updated.averageCost ?? '');
      setIngredient(updated);
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Editar ingrediente" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (notFound || !ingredient) {
    return (
      <AppShell>
        <PageHeader title="Editar ingrediente" />
        <EmptyState title="Ingrediente não encontrado" description="Ele pode ter sido removido ou o link está incorreto." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={`Editar — ${ingredient.name}`} description="Dados de cadastro e custo do ingrediente." />

      <Card className="mb-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Dados gerais</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ing-name">Nome</Label>
              <Input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} />
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
              <Label htmlFor="ing-storage">Local de armazenamento</Label>
              <Input
                id="ing-storage"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="ing-min">Estoque mínimo</Label>
              <Input id="ing-min" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} inputMode="decimal" placeholder="Opcional" />
            </div>

            <div className="md:col-span-2 border-t border-border pt-4">
              <Label htmlFor="ing-cost">Custo médio (R$)</Label>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  id="ing-cost"
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  inputMode="decimal"
                  placeholder="Opcional"
                  className="max-w-[160px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                >
                  <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                  {recalculating ? 'Recalculando…' : 'Recalcular a partir das últimas compras'}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa as duas últimas compras confirmadas deste ingrediente para calcular o custo médio
                ponderado — não precisa digitar no chute.
              </p>
              {recalculateError && <p className="mt-1 text-sm text-danger">{recalculateError}</p>}
              {ingredient.lastCost && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Último custo pago (atualizado automaticamente a cada compra): R$ {ingredient.lastCost}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              {saveError && <p className="text-sm text-danger">{saveError}</p>}
              {saveSuccess && (
                <p className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Salvo.
                </p>
              )}
              <Button type="submit" disabled={saving} className="ml-auto">
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/ingredients')}>
                Voltar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}

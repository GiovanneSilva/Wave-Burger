'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { MoneyValue } from '@/components/wave/money-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { formatPercentage } from '@/lib/format';
import type { Product, FichaTecnicaVersion, Ingredient, SimulationResult } from '@/lib/types';

const UNITS = ['kg', 'g', 'l', 'ml', 'un'];

interface Row {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  lossPercentage: string;
}

function emptyRow(): Row {
  return { key: crypto.randomUUID(), ingredientId: '', quantity: '', unit: 'kg', lossPercentage: '' };
}

export default function EditFichaTecnicaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Importar ficha técnica de outro produto
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);
  const [importFromProductId, setImportFromProductId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [productRes, ingredientsRes, fichaRes, productsRes] = await Promise.all([
        fetch(`/api/products/${productId}`),
        fetch('/api/ingredients'),
        fetch(`/api/products/${productId}/ficha-tecnica`),
        fetch('/api/products'),
      ]);

      if (cancelled) return;

      if (productRes.ok) setProduct(await productRes.json());
      if (ingredientsRes.ok) {
        const all: Ingredient[] = await ingredientsRes.json();
        setIngredients(all.filter((i) => i.isActive));
      }
      if (productsRes.ok) {
        const allProducts: Product[] = await productsRes.json();
        setOtherProducts(allProducts.filter((p) => p.id !== productId && p.status !== 'INACTIVE'));
      }
      if (fichaRes.ok) {
        const ficha: FichaTecnicaVersion = await fichaRes.json();
        if (ficha.items.length > 0) {
          setRows(
            ficha.items.map((item) => ({
              key: item.id,
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unit: item.unit,
              lossPercentage: item.lossPercentage !== '0' ? item.lossPercentage : '',
            })),
          );
        }
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const validRows = useMemo(
    () => rows.filter((r) => r.ingredientId && r.quantity && r.unit),
    [rows],
  );

  async function handleImport() {
    setImportError(null);
    setImportSuccess(null);

    if (!importFromProductId) {
      setImportError('Escolha um produto para importar.');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/products/${importFromProductId}/ficha-tecnica`);
      if (!res.ok) {
        setImportError('Esse produto ainda não tem ficha técnica cadastrada.');
        return;
      }

      const ficha: FichaTecnicaVersion = await res.json();
      setRows(
        ficha.items.map((item) => ({
          key: crypto.randomUUID(),
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          lossPercentage: item.lossPercentage !== '0' ? item.lossPercentage : '',
        })),
      );

      const sourceName = otherProducts.find((p) => p.id === importFromProductId)?.name ?? 'produto selecionado';
      setImportSuccess(
        `${ficha.items.length} ingrediente(s) importado(s) de "${sourceName}" — revise as quantidades antes de salvar.`,
      );
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    if (validRows.length === 0) {
      setSimulation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSimulationError(null);
      const res = await fetch(`/api/products/${productId}/ficha-tecnica/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map((r) => ({
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: r.unit,
            lossPercentage: r.lossPercentage ? Number(r.lossPercentage) : undefined,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível calcular.' }));
        setSimulationError(body.message);
        setSimulation(null);
        return;
      }

      setSimulation(await res.json());
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(validRows), productId]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSave() {
    setSaveError(null);

    if (validRows.length === 0) {
      setSaveError('A ficha técnica precisa de pelo menos um ingrediente.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/ficha-tecnica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map((r) => ({
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: r.unit,
            lossPercentage: r.lossPercentage ? Number(r.lossPercentage) : undefined,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível salvar.' }));
        setSaveError(body.message);
        return;
      }

      router.push(`/products/${productId}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Ficha técnica" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={product ? `Ficha técnica — ${product.name}` : 'Ficha técnica'}
        description="Alterações aqui criam uma nova versão — a anterior é preservada no histórico."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {otherProducts.length > 0 && (
            <Card>
              <CardContent className="flex flex-wrap items-end gap-2 pt-5">
                <div className="min-w-[220px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Importar ficha técnica de outro produto
                  </label>
                  <Select value={importFromProductId} onChange={(e) => setImportFromProductId(e.target.value)}>
                    <option value="">Selecione um produto…</option>
                    {otherProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" variant="secondary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando…' : 'Importar'}
                </Button>
                {(importError || importSuccess) && (
                  <p className={`w-full text-xs ${importError ? 'text-danger' : 'text-success'}`}>
                    {importError ?? importSuccess}
                  </p>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  Isso substitui as linhas abaixo pelos ingredientes do produto escolhido — revise antes de salvar.
                </p>
              </CardContent>
            </Card>
          )}

          {rows.map((row) => {
            const itemResult = simulation?.items.find(
              (i) => i.ingredientId === row.ingredientId && i.quantity === row.quantity && i.unit === row.unit,
            );
            return (
              <div key={row.key} className="flex items-end gap-2 rounded-lg border border-border bg-card p-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Ingrediente</label>
                  <Select
                    value={row.ingredientId}
                    onChange={(e) => updateRow(row.key, { ingredientId: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs text-muted-foreground">Quantidade</label>
                  <Input
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-xs text-muted-foreground">Unidade</label>
                  <Select value={row.unit} onChange={(e) => updateRow(row.key, { unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-xs text-muted-foreground">Perda %</label>
                  <Input
                    value={row.lossPercentage}
                    onChange={(e) => updateRow(row.key, { lossPercentage: e.target.value })}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
                <div className="w-20 pb-2 text-right text-sm tabular-nums text-muted-foreground">
                  {itemResult ? <MoneyValue value={itemResult.lineCost} /> : '—'}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeRow(row.key)} aria-label="Remover ingrediente">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          <Button variant="secondary" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="self-start">
            <Plus className="h-4 w-4" /> Adicionar ingrediente
          </Button>

          {simulationError && (
            <p className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {simulationError}
            </p>
          )}
        </div>

        <div>
          <Card className="sticky top-6">
            <CardContent className="flex flex-col gap-2 pt-5 text-sm">
              <p className="mb-1 font-medium text-foreground">Resumo</p>
              <SummaryRow
                label="Ingredientes"
                value={simulation ? <MoneyValue value={simulation.simulatedTotals.ingredientsCost} /> : '—'}
              />
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <span>Custo total</span>
                {simulation ? <MoneyValue value={simulation.simulatedTotals.totalCost} /> : <span>—</span>}
              </div>
              {product?.salePrice && (
                <SummaryRow label="Preço" value={<MoneyValue value={product.salePrice} />} />
              )}
              <SummaryRow
                label="CMV"
                value={
                  simulation?.simulatedTotals.cmvPercentage !== null &&
                  simulation?.simulatedTotals.cmvPercentage !== undefined
                    ? formatPercentage(simulation.simulatedTotals.cmvPercentage)
                    : '—'
                }
              />
              <SummaryRow
                label="Margem"
                value={
                  simulation?.simulatedTotals.marginPercentage !== null &&
                  simulation?.simulatedTotals.marginPercentage !== undefined
                    ? formatPercentage(simulation.simulatedTotals.marginPercentage)
                    : '—'
                }
              />

              {saveError && <p className="text-sm text-danger">{saveError}</p>}

              <Button onClick={handleSave} disabled={saving || validRows.length === 0} className="mt-3">
                {saving ? 'Salvando…' : 'Salvar nova versão'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

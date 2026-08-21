'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { MoneyValue } from '@/components/wave/money-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth/auth-provider';
import type { Supplier, Ingredient } from '@/lib/types';

const UNITS = ['kg', 'g', 'l', 'ml', 'un'];

interface Row {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

function emptyRow(): Row {
  return { key: crypto.randomUUID(), ingredientId: '', quantity: '', unit: 'kg', unitPrice: '' };
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/suppliers'), fetch('/api/ingredients')]).then(async ([supRes, ingRes]) => {
      if (supRes.ok) setSuppliers((await supRes.json()).filter((s: Supplier) => s.isActive));
      if (ingRes.ok) setIngredients((await ingRes.json()).filter((i: Ingredient) => i.isActive));
    });
  }, []);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const validRows = rows.filter((r) => r.ingredientId && r.quantity && r.unit && r.unitPrice);
  const total = validRows.reduce((sum, r) => sum + Number(r.quantity) * Number(r.unitPrice), 0);

  async function handleSubmit() {
    setError(null);

    if (!supplierId) {
      setError('Selecione um fornecedor.');
      return;
    }
    if (validRows.length === 0) {
      setError('Adicione ao menos um item com quantidade e preço.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          businessUnitId: user?.businessUnitId,
          purchaseDate: new Date(purchaseDate).toISOString(),
          items: validRows.map((r) => ({
            ingredientId: r.ingredientId,
            quantity: r.quantity,
            unit: r.unit,
            unitPrice: r.unitPrice,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível registrar a compra.' }));
        setError(body.message);
        return;
      }

      const purchase = await res.json();
      router.push(`/purchases/${purchase.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Nova compra" description="Registrada como rascunho — confirme depois de revisar." />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="pur-supplier">Fornecedor</Label>
          <Select id="pur-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Selecione…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pur-date">Data</Label>
          <Input id="pur-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-end gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Ingrediente</label>
              <Select value={row.ingredientId} onChange={(e) => updateRow(row.key, { ingredientId: e.target.value })}>
                <option value="">Selecione…</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-muted-foreground">Quantidade</label>
              <Input value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} inputMode="decimal" />
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
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted-foreground">Preço unitário</label>
              <Input value={row.unitPrice} onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })} inputMode="decimal" />
            </div>
            <div className="w-24 pb-2 text-right text-sm tabular-nums text-muted-foreground">
              {row.quantity && row.unitPrice ? (
                <MoneyValue value={Number(row.quantity) * Number(row.unitPrice)} />
              ) : (
                '—'
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeRow(row.key)} aria-label="Remover item">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button variant="secondary" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="self-start">
          <Plus className="h-4 w-4" /> Adicionar item
        </Button>
      </div>

      <Card className="mt-6 max-w-xs">
        <CardContent className="flex flex-col gap-2 pt-5 text-sm">
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <MoneyValue value={total} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSubmit} disabled={saving} className="mt-2">
            {saving ? 'Salvando…' : 'Registrar compra'}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

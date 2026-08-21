'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { MoneyValue } from '@/components/wave/money-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth/auth-provider';
import type { Product, Sale } from '@/lib/types';

export default function NewSalePage() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discountType, setDiscountType] = useState<'' | 'PERCENTAGE' | 'FIXED'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Sale | null>(null);

  useEffect(() => {
    fetch('/api/products').then(async (res) => {
      if (res.ok) {
        const all: Product[] = await res.json();
        setProducts(all.filter((p) => p.status === 'ACTIVE'));
      }
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const grossPreview =
    selectedProduct?.salePrice && quantity ? Number(selectedProduct.salePrice) * Number(quantity) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!productId || !quantity) {
      setError('Selecione o produto e informe a quantidade.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessUnitId: user?.businessUnitId,
          productId,
          quantity,
          discountType: discountType || undefined,
          discountValue: discountType ? discountValue : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível registrar a venda.' }));
        setError(body.message);
        return;
      }

      const sale: Sale = await res.json();
      setResult(sale);
      setQuantity('1');
      setDiscountType('');
      setDiscountValue('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Nova venda" description="Consome o estoque automaticamente segundo a ficha técnica do produto." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="sale-product">Produto</Label>
                <Select id="sale-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.salePrice ? `— R$ ${p.salePrice}` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale-quantity">Quantidade</Label>
                  <Input id="sale-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale-discount-type">Desconto</Label>
                  <Select
                    id="sale-discount-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as '' | 'PERCENTAGE' | 'FIXED')}
                  >
                    <option value="">Sem desconto</option>
                    <option value="PERCENTAGE">Percentual (%)</option>
                    <option value="FIXED">Valor fixo (R$)</option>
                  </Select>
                </div>
                {discountType && (
                  <div>
                    <Label htmlFor="sale-discount-value">
                      {discountType === 'PERCENTAGE' ? 'Percentual' : 'Valor (R$)'}
                    </Label>
                    <Input
                      id="sale-discount-value"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" disabled={saving} className="self-start">
                {saving ? 'Registrando…' : 'Registrar venda'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {grossPreview !== null && !result && (
            <Card>
              <CardContent className="flex flex-col gap-1.5 pt-5 text-sm">
                <p className="font-medium text-foreground">Prévia</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor bruto</span>
                  <MoneyValue value={grossPreview} />
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className={result.hadInsufficientStock ? 'border-warning/40' : 'border-success/40'}>
              <CardContent className="flex flex-col gap-2 pt-5 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {result.hadInsufficientStock ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  Venda registrada
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <MoneyValue value={result.netAmount} />
                </div>

                {result.hadInsufficientStock && result.stockWarnings && (
                  <div className="mt-2 rounded-md bg-warning-bg p-3 text-xs text-foreground">
                    <p className="mb-1 font-medium">Estoque ficou negativo — a venda foi registrada mesmo assim:</p>
                    {result.stockWarnings.map((w) => (
                      <p key={w.ingredientId}>
                        {w.ingredientName}: saldo atual {w.resultingBalance}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

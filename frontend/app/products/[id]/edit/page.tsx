'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Product } from '@/lib/types';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data: Product = await res.json();
    setProduct(data);
    setName(data.name);
    setInternalCode(data.internalCode ?? '');
    setCategory(data.category ?? '');
    setDescription(data.description ?? '');
    setSalePrice(data.salePrice ?? '');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!name) {
      setSaveError('Nome é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          internalCode: internalCode || undefined,
          category: category || undefined,
          description: description || undefined,
          salePrice: salePrice || undefined,
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

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Editar produto" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (notFound || !product) {
    return (
      <AppShell>
        <PageHeader title="Editar produto" />
        <EmptyState title="Produto não encontrado" description="Ele pode ter sido removido ou o link está incorreto." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={`Editar — ${product.name}`} description="Dados gerais e preço de venda do produto." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados gerais</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="prod-name">Nome</Label>
              <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prod-code">Código interno</Label>
                <Input id="prod-code" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="prod-category">Categoria</Label>
                <Input id="prod-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div>
              <Label htmlFor="prod-description">Descrição</Label>
              <Input id="prod-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>

            <div className="max-w-xs">
              <Label htmlFor="prod-price">Preço de venda (R$)</Label>
              <Input id="prod-price" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" placeholder="Opcional" />
              <p className="mt-1 text-xs text-muted-foreground">
                Alterar aqui muda o preço praticado a partir de agora — não afeta vendas já registradas.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {saveError && <p className="text-sm text-danger">{saveError}</p>}
              {saveSuccess && (
                <p className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Salvo.
                </p>
              )}
              <Button type="submit" disabled={saving} className="ml-auto">
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/products/${productId}`)}>
                Voltar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}

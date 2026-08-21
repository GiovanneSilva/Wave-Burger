'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [averagePrepTimeMinutes, setAveragePrepTimeMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name) {
      setError('Nome é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          internalCode: internalCode || undefined,
          category: category || undefined,
          description: description || undefined,
          salePrice: salePrice || undefined,
          finalWeight: finalWeight || undefined,
          averagePrepTimeMinutes: averagePrepTimeMinutes ? Number(averagePrepTimeMinutes) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível criar o produto.' }));
        setError(body.message);
        return;
      }

      const product = await res.json();
      // UC-001: "Sistema permite prosseguir para ficha técnica" — o
      // produto nasce como rascunho e não pode ser ativado sem ficha
      // técnica válida (BR-001), então o próximo passo natural é montar
      // a composição na hora.
      router.push(`/products/${product.id}/ficha-tecnica/edit`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Novo produto"
        description="Criado como rascunho — depois de montar a ficha técnica, ele pode ser ativado para venda."
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="prod-name">Nome</Label>
              <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Smash Burger" />
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="prod-price">Preço de venda (R$)</Label>
                <Input id="prod-price" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} inputMode="decimal" placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="prod-weight">Peso final (g)</Label>
                <Input id="prod-weight" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} inputMode="decimal" placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="prod-prep">Tempo de preparo (min)</Label>
                <Input
                  id="prod-prep"
                  value={averagePrepTimeMinutes}
                  onChange={(e) => setAveragePrepTimeMinutes(e.target.value)}
                  inputMode="numeric"
                  placeholder="Opcional"
                />
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={saving} className="self-start">
              {saving ? 'Criando…' : 'Criar produto e montar ficha técnica'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}

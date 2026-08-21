'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Star, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { StatusBadge } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Supplier, SupplierIngredientLink, Ingredient } from '@/lib/types';

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [links, setLinks] = useState<SupplierIngredientLink[] | null>(null);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const [toUnlink, setToUnlink] = useState<SupplierIngredientLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  async function load() {
    const [supplierRes, linksRes, ingredientsRes] = await Promise.all([
      fetch(`/api/suppliers/${supplierId}`),
      fetch(`/api/suppliers/${supplierId}/ingredients`),
      fetch('/api/ingredients'),
    ]);

    if (supplierRes.ok) setSupplier(await supplierRes.json());
    if (linksRes.ok) setLinks(await linksRes.json());
    if (ingredientsRes.ok) {
      const all: Ingredient[] = await ingredientsRes.json();
      setAllIngredients(all.filter((i) => i.isActive));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const linkedIds = new Set((links ?? []).map((l) => l.ingredientId));
  const availableToLink = allIngredients.filter((i) => !linkedIds.has(i.id));

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);

    if (!selectedIngredientId) {
      setLinkError('Selecione um ingrediente.');
      return;
    }

    setLinking(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId: selectedIngredientId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível vincular.' }));
        setLinkError(body.message);
        return;
      }

      setSelectedIngredientId('');
      setLinkFormOpen(false);
      await load();
    } finally {
      setLinking(false);
    }
  }

  async function handleMarkPreferred(link: SupplierIngredientLink) {
    await fetch(`/api/suppliers/${supplierId}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId: link.ingredientId, isPreferred: true }),
    });
    await load();
  }

  async function handleUnlinkConfirm() {
    if (!toUnlink) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/ingredients/${toUnlink.ingredientId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setToUnlink(null);
        await load();
      }
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Fornecedor" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!supplier) {
    return (
      <AppShell>
        <PageHeader title="Fornecedor" />
        <EmptyState title="Fornecedor não encontrado" description="Ele pode ter sido removido ou o link está incorreto." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={supplier.name}
        description={supplier.paymentTerms ?? undefined}
        actions={<StatusBadge label={supplier.isActive ? 'Ativo' : 'Inativo'} tone={supplier.isActive ? 'success' : 'neutral'} />}
      />

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 pt-5 text-sm md:grid-cols-4">
          <InfoField label="Contato" value={supplier.contactName} />
          <InfoField label="Telefone" value={supplier.contactPhone} />
          <InfoField label="E-mail" value={supplier.contactEmail} />
          <InfoField label="Prazo médio de entrega" value={supplier.averageDeliveryDays ? `${supplier.averageDeliveryDays} dias` : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Ingredientes fornecidos</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setLinkFormOpen((v) => !v)}>
            {linkFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {linkFormOpen ? 'Cancelar' : 'Vincular ingrediente'}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {linkFormOpen && (
            <form onSubmit={handleLink} className="mb-4 flex items-end gap-2 rounded-md border border-border p-3">
              <div className="flex-1">
                <Label htmlFor="link-ingredient">Ingrediente</Label>
                <Select
                  id="link-ingredient"
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {availableToLink.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={linking}>
                {linking ? 'Vinculando…' : 'Vincular'}
              </Button>
              {linkError && <p className="text-sm text-danger">{linkError}</p>}
            </form>
          )}

          {!links || links.length === 0 ? (
            <EmptyState
              title="Nenhum ingrediente vinculado"
              description="Vincule os ingredientes que este fornecedor entrega."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {link.ingredient.name}
                    {link.isPreferred && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Star className="h-3 w-3 fill-primary" aria-hidden="true" /> Preferencial
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {!link.isPreferred && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkPreferred(link)}>
                        Marcar como preferencial
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setToUnlink(link)}>
                      Desvincular
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={toUnlink !== null}
        onOpenChange={(open) => !open && setToUnlink(null)}
        title="Desvincular ingrediente?"
        description={`${supplier.name} deixará de aparecer como fornecedor de ${toUnlink?.ingredient.name}.`}
        confirmLabel="Desvincular"
        destructive
        onConfirm={handleUnlinkConfirm}
        loading={unlinking}
      />
    </AppShell>
  );
}

function InfoField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-foreground">{value ?? '—'}</p>
    </div>
  );
}

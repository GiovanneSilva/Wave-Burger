'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { StatusBadge, PURCHASE_STATUS_MAP } from '@/components/wave/status-badge';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { Purchase, Supplier, Ingredient } from '@/lib/types';

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const purchaseId = params.id;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [supplierName, setSupplierName] = useState<string>('—');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const [purchaseRes, ingredientsRes] = await Promise.all([
      fetch(`/api/purchases/${purchaseId}`),
      fetch('/api/ingredients'),
    ]);

    if (purchaseRes.ok) {
      const p: Purchase = await purchaseRes.json();
      setPurchase(p);

      const supRes = await fetch(`/api/suppliers/${p.supplierId}`);
      if (supRes.ok) {
        const supplier: Supplier = await supRes.json();
        setSupplierName(supplier.name);
      }
    }
    if (ingredientsRes.ok) setIngredients(await ingredientsRes.json());

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  async function handleConfirm() {
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível confirmar.' }));
        setActionError(body.message);
        return;
      }
      setConfirmOpen(false);
      await load();
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível cancelar.' }));
        setActionError(body.message);
        return;
      }
      setCancelOpen(false);
      await load();
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Compra" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!purchase) {
    return (
      <AppShell>
        <PageHeader title="Compra" />
        <EmptyState title="Compra não encontrada" description="Ela pode ter sido removida ou o link está incorreto." />
      </AppShell>
    );
  }

  const statusInfo = PURCHASE_STATUS_MAP[purchase.status];
  const isDraft = purchase.status === 'DRAFT';

  return (
    <AppShell>
      <PageHeader
        title={`Compra — ${supplierName}`}
        description={new Date(purchase.purchaseDate).toLocaleDateString('pt-BR')}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
            {isDraft && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => setConfirmOpen(true)}>
                  Confirmar compra
                </Button>
              </>
            )}
          </div>
        }
      />

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isDraft && (
        <p className="mb-4 text-sm text-muted-foreground">
          Ao confirmar, o estoque recebe entrada automática, o custo do ingrediente é atualizado e um
          lançamento de conta a pagar é criado — tudo automaticamente.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Ingrediente</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Preço unitário</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchase.items.map((item) => {
            const ingredientName = ingredients.find((i) => i.id === item.ingredientId)?.name ?? item.ingredientId;
            return (
              <TableRow key={item.id}>
                <TableCell>{ingredientName}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell className="text-right">
                  <MoneyValue value={item.unitPrice} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyValue value={item.totalPrice} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-4 flex justify-end text-sm font-medium">
        Total: <span className="ml-2 tabular-nums">
          <MoneyValue value={purchase.totalAmount} />
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar compra?"
        description="Isso vai gerar entrada de estoque, atualizar o custo do ingrediente e criar a conta a pagar. Não pode ser desfeito."
        confirmLabel="Confirmar"
        onConfirm={handleConfirm}
        loading={acting}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar compra?"
        description="A compra será marcada como cancelada — nenhum efeito em estoque ou financeiro é gerado."
        confirmLabel="Cancelar compra"
        destructive
        onConfirm={handleCancel}
        loading={acting}
      />
    </AppShell>
  );
}

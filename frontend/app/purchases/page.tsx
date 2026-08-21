'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { StatusBadge, PURCHASE_STATUS_MAP } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { Button } from '@/components/ui/button';
import type { Purchase, Supplier } from '@/lib/types';

interface PurchaseRow extends Purchase {
  supplierName: string;
}

export default function PurchasesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PurchaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const [purchasesRes, suppliersRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/suppliers'),
      ]);

      if (!purchasesRes.ok) {
        if (!cancelled) setError('Não foi possível carregar as compras.');
        return;
      }

      const purchases: Purchase[] = await purchasesRes.json();
      const suppliers: Supplier[] = suppliersRes.ok ? await suppliersRes.json() : [];
      const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));

      if (!cancelled) {
        setRows(purchases.map((p) => ({ ...p, supplierName: supplierById.get(p.supplierId) ?? '—' })));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: DataTableColumn<PurchaseRow>[] = [
    { key: 'supplier', header: 'Fornecedor', render: (p) => <span className="font-medium">{p.supplierName}</span> },
    { key: 'date', header: 'Data', render: (p) => new Date(p.purchaseDate).toLocaleDateString('pt-BR') },
    { key: 'items', header: 'Itens', render: (p) => p.items.length },
    { key: 'total', header: 'Total', align: 'right', render: (p) => <MoneyValue value={p.totalAmount} /> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const s = PURCHASE_STATUS_MAP[p.status];
        return <StatusBadge label={s.label} tone={s.tone} />;
      },
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Compras"
        description="Registro e confirmação de compras — confirmar dispara entrada de estoque e lançamento financeiro."
        actions={
          <Button onClick={() => router.push('/purchases/new')}>
            <Plus className="h-4 w-4" /> Nova compra
          </Button>
        }
      />

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-4" />}

      {rows === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando compras…</p>
      ) : (
        rows && (
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/purchases/${p.id}`)}
            emptyTitle="Nenhuma compra ainda"
            emptyDescription="Registre a primeira compra de um fornecedor."
          />
        )
      )}
    </AppShell>
  );
}

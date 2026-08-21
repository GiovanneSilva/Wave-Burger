'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import type { Sale, Product } from '@/lib/types';

interface SaleRow extends Sale {
  productName: string;
}

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.businessUnitId) return;
    let cancelled = false;

    async function load() {
      setError(null);
      const [salesRes, productsRes] = await Promise.all([
        fetch(`/api/sales?businessUnitId=${user!.businessUnitId}`),
        fetch('/api/products'),
      ]);

      if (!salesRes.ok) {
        if (!cancelled) setError('Não foi possível carregar as vendas.');
        return;
      }

      const sales: Sale[] = await salesRes.json();
      const products: Product[] = productsRes.ok ? await productsRes.json() : [];
      const productById = new Map(products.map((p) => [p.id, p.name]));

      if (!cancelled) {
        setRows(sales.map((s) => ({ ...s, productName: productById.get(s.productId) ?? '—' })));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.businessUnitId]);

  const columns: DataTableColumn<SaleRow>[] = [
    { key: 'product', header: 'Produto', render: (s) => <span className="font-medium">{s.productName}</span> },
    { key: 'date', header: 'Data', render: (s) => new Date(s.saleDate).toLocaleString('pt-BR') },
    { key: 'quantity', header: 'Qtd.', align: 'right', render: (s) => s.quantity },
    { key: 'net', header: 'Valor', align: 'right', render: (s) => <MoneyValue value={s.netAmount} /> },
    {
      key: 'warning',
      header: '',
      render: (s) =>
        s.hadInsufficientStock ? (
          <span className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Estoque insuficiente
          </span>
        ) : null,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Vendas"
        description="Registro de vendas — consome o estoque automaticamente segundo a ficha técnica."
        actions={
          <Button onClick={() => router.push('/sales/new')}>
            <Plus className="h-4 w-4" /> Nova venda
          </Button>
        }
      />

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-4" />}

      {rows === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando vendas…</p>
      ) : (
        rows && (
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(s) => s.id}
            emptyTitle="Nenhuma venda ainda"
            emptyDescription="Registre a primeira venda de um produto ativo."
          />
        )
      )}
    </AppShell>
  );
}

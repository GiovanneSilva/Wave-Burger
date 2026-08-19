'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { StatusBadge, PRODUCT_STATUS_MAP } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { formatPercentage } from '@/lib/format';
import type { Product, FichaTecnicaVersion } from '@/lib/types';

interface ProductRow extends Product {
  totalCost: number | null;
  cmvPercentage: number | null;
  marginPercentage: number | null;
}

export default function ProductsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const res = await fetch('/api/products');
      if (!res.ok) {
        if (!cancelled) setError('Não foi possível carregar os produtos.');
        return;
      }
      const products: Product[] = await res.json();

      const withCost = await Promise.all(
        products.map(async (product) => {
          const fichaRes = await fetch(`/api/products/${product.id}/ficha-tecnica`);
          if (!fichaRes.ok) {
            return { ...product, totalCost: null, cmvPercentage: null, marginPercentage: null };
          }
          const ficha: FichaTecnicaVersion = await fichaRes.json();
          return {
            ...product,
            totalCost: Number(ficha.totalCost),
            cmvPercentage: ficha.cmvPercentage !== null ? Number(ficha.cmvPercentage) : null,
            marginPercentage: ficha.marginPercentage !== null ? Number(ficha.marginPercentage) : null,
          };
        }),
      );

      if (!cancelled) setRows(withCost);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: DataTableColumn<ProductRow>[] = [
    { key: 'name', header: 'Produto', render: (p) => <span className="font-medium">{p.name}</span> },
    {
      key: 'cost',
      header: 'Custo',
      align: 'right',
      render: (p) => (p.totalCost !== null ? <MoneyValue value={p.totalCost} /> : '—'),
    },
    {
      key: 'price',
      header: 'Venda',
      align: 'right',
      render: (p) => (p.salePrice !== null ? <MoneyValue value={p.salePrice} /> : '—'),
    },
    {
      key: 'cmv',
      header: 'CMV',
      align: 'right',
      render: (p) => (p.cmvPercentage !== null ? formatPercentage(p.cmvPercentage) : '—'),
    },
    {
      key: 'margin',
      header: 'Margem',
      align: 'right',
      render: (p) => (p.marginPercentage !== null ? formatPercentage(p.marginPercentage) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const s = PRODUCT_STATUS_MAP[p.status];
        return <StatusBadge label={s.label} tone={s.tone} />;
      },
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Produtos"
        description="Custo, preço e margem calculados a partir da ficha técnica corrente de cada produto."
      />

      {error && (
        <EmptyState title="Não foi possível carregar" description={error} className="mb-4" />
      )}

      {rows === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando produtos…</p>
      ) : (
        rows && (
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/products/${p.id}`)}
            emptyTitle="Nenhum produto ainda"
            emptyDescription="Cadastre seu primeiro produto para começar a montar a ficha técnica."
          />
        )
      )}
    </AppShell>
  );
}

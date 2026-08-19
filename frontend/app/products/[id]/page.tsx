'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { StatusBadge, PRODUCT_STATUS_MAP } from '@/components/wave/status-badge';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatPercentage } from '@/lib/format';
import type { Product, FichaTecnicaVersion, CurrentCostSummary } from '@/lib/types';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [ficha, setFicha] = useState<FichaTecnicaVersion | null>(null);
  const [fichaError, setFichaError] = useState(false);
  const [costSummary, setCostSummary] = useState<CurrentCostSummary | null>(null);
  const [history, setHistory] = useState<FichaTecnicaVersion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const productRes = await fetch(`/api/products/${productId}`);
      if (!productRes.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const productData: Product = await productRes.json();
      if (cancelled) return;
      setProduct(productData);

      const [fichaRes, costRes, historyRes] = await Promise.all([
        fetch(`/api/products/${productId}/ficha-tecnica`),
        fetch(`/api/products/${productId}/ficha-tecnica/current-cost`),
        fetch(`/api/products/${productId}/ficha-tecnica/history`),
      ]);

      if (cancelled) return;

      if (fichaRes.ok) setFicha(await fichaRes.json());
      else setFichaError(true);

      if (costRes.ok) setCostSummary(await costRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Produto" />
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell>
        <PageHeader title="Produto" />
        <EmptyState title="Produto não encontrado" description="Ele pode ter sido removido ou o link está incorreto." />
      </AppShell>
    );
  }

  const statusInfo = PRODUCT_STATUS_MAP[product.status];

  return (
    <AppShell>
      <PageHeader
        title={product.name}
        description={product.internalCode ? `Código: ${product.internalCode}` : undefined}
        actions={<StatusBadge label={statusInfo.label} tone={statusInfo.tone} />}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="ficha">Ficha técnica</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {fichaError || !ficha ? (
            <EmptyState
              title="Sem ficha técnica"
              description="Este produto ainda não tem uma ficha técnica cadastrada — os indicadores de custo aparecem aqui assim que ela existir."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat label="Preço de venda" value={product.salePrice ? <MoneyValue value={product.salePrice} /> : '—'} />
              <MiniStat label="Custo atual" value={<MoneyValue value={ficha.totalCost} />} />
              <MiniStat
                label="CMV"
                value={ficha.cmvPercentage !== null ? formatPercentage(Number(ficha.cmvPercentage)) : '—'}
              />
              <MiniStat
                label="Margem"
                value={ficha.marginPercentage !== null ? formatPercentage(Number(ficha.marginPercentage)) : '—'}
              />
            </div>
          )}

          {costSummary?.costDrifted && (
            <Card className="mt-4 border-warning/40">
              <CardContent className="flex items-start gap-3 pt-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">O custo dos ingredientes mudou desde a última versão</p>
                  <p className="mt-1 text-muted-foreground">
                    Custo desta versão: <MoneyValue value={costSummary.frozenAtVersionCreation.totalCost} /> · Custo
                    com preços atuais: <MoneyValue value={costSummary.currentLive.totalCost} /> — crie uma nova
                    versão da ficha técnica na aba &ldquo;Ficha técnica&rdquo; para atualizar.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ficha">
          {fichaError || !ficha ? (
            <EmptyState title="Sem ficha técnica" description="Cadastre a composição deste produto." />
          ) : (
            <div className="flex flex-col gap-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ficha.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.ingredient?.name ?? item.ingredientId}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        <MoneyValue value={item.lineCost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Card className="max-w-sm self-end">
                <CardContent className="flex flex-col gap-1.5 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingredientes</span>
                    <MoneyValue value={ficha.ingredientsCost} />
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-medium">
                    <span>Custo total</span>
                    <MoneyValue value={ficha.totalCost} />
                  </div>
                  {product.salePrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço</span>
                      <MoneyValue value={product.salePrice} />
                    </div>
                  )}
                  {ficha.cmvPercentage !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CMV</span>
                      <span>{formatPercentage(Number(ficha.cmvPercentage))}</span>
                    </div>
                  )}
                  {ficha.marginPercentage !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margem</span>
                      <span>{formatPercentage(Number(ficha.marginPercentage))}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs">
          {!costSummary ? (
            <EmptyState title="Sem dados de custo" description="Cadastre a ficha técnica para ver esta análise." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Congelado na versão {costSummary.version}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
                  <CostRow label="Custo total" value={costSummary.frozenAtVersionCreation.totalCost} money />
                  <CostRow label="CMV" value={costSummary.frozenAtVersionCreation.cmvPercentage} percent />
                  <CostRow label="Margem" value={costSummary.frozenAtVersionCreation.marginPercentage} percent />
                  <CostRow label="Lucro estimado" value={costSummary.frozenAtVersionCreation.estimatedProfit} money />
                </CardContent>
              </Card>

              <Card className={costSummary.costDrifted ? 'border-warning/40' : undefined}>
                <CardHeader>
                  <CardTitle>Com custo atual dos ingredientes</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 pt-0 text-sm">
                  <CostRow label="Custo total" value={costSummary.currentLive.totalCost} money />
                  <CostRow label="CMV" value={costSummary.currentLive.cmvPercentage} percent />
                  <CostRow label="Margem" value={costSummary.currentLive.marginPercentage} percent />
                  <CostRow label="Lucro estimado" value={costSummary.currentLive.estimatedProfit} money />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {!history || history.length === 0 ? (
            <EmptyState title="Nenhuma versão ainda" description="O histórico aparece assim que a ficha técnica for criada." />
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((v) => (
                <Card key={v.id}>
                  <CardContent className="flex items-center justify-between pt-4 text-sm">
                    <div>
                      <span className="font-medium text-foreground">Versão {v.version}</span>
                      {v.isCurrent && <span className="ml-2 text-xs text-primary">(corrente)</span>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums text-muted-foreground">
                      <MoneyValue value={v.totalCost} />
                      {v.marginPercentage !== null && <span>{formatPercentage(Number(v.marginPercentage))}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-subtle">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function CostRow({
  label,
  value,
  money,
  percent,
}: {
  label: string;
  value: number | null;
  money?: boolean;
  percent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {value === null ? '—' : money ? <MoneyValue value={value} /> : percent ? formatPercentage(value) : value}
      </span>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { StatusBadge } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/auth-provider';
import type { ConsumptionItem, SupplierAnalysis, Ingredient, MenuEngineeringMatrix } from '@/lib/types';

function last30Days() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const businessUnitId = user?.businessUnitId;

  const [{ from, to }, setRange] = useState(last30Days());
  const [consumption, setConsumption] = useState<ConsumptionItem[] | null>(null);
  const [consumptionError, setConsumptionError] = useState<string | null>(null);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [supplierAnalysis, setSupplierAnalysis] = useState<SupplierAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [driftThreshold, setDriftThreshold] = useState('10');
  const [menuMatrix, setMenuMatrix] = useState<MenuEngineeringMatrix | null>(null);
  const [menuMatrixError, setMenuMatrixError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ingredients').then(async (res) => {
      if (res.ok) setIngredients(await res.json());
    });
  }, []);

  useEffect(() => {
    if (!businessUnitId) return;
    setConsumptionError(null);
    fetch(`/api/analytics/stock?businessUnitId=${businessUnitId}&from=${from}&to=${to}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setConsumption(data.consumoPeriodo);
      } else {
        setConsumptionError('Não foi possível carregar o consumo do período.');
      }
    });
  }, [businessUnitId, from, to]);

  useEffect(() => {
    setMenuMatrixError(null);
    const threshold = Number(driftThreshold) || 10;
    fetch(`/api/analytics/menu-engineering?from=${from}&to=${to}&driftThresholdPercent=${threshold}`).then(
      async (res) => {
        if (res.ok) {
          setMenuMatrix(await res.json());
        } else {
          setMenuMatrixError('Não foi possível carregar a Engenharia de Cardápio.');
        }
      },
    );
  }, [from, to, driftThreshold]);

  useEffect(() => {
    if (!selectedIngredientId) {
      setSupplierAnalysis(null);
      return;
    }
    setAnalysisError(null);
    fetch(`/api/analytics/suppliers/${selectedIngredientId}`).then(async (res) => {
      if (res.ok) {
        setSupplierAnalysis(await res.json());
      } else {
        setAnalysisError('Não foi possível carregar a análise deste ingrediente.');
        setSupplierAnalysis(null);
      }
    });
  }, [selectedIngredientId]);

  const consumptionColumns: DataTableColumn<ConsumptionItem>[] = [
    { key: 'name', header: 'Ingrediente', render: (c) => <span className="font-medium">{c.ingredientName}</span> },
    { key: 'total', header: 'Total consumido', align: 'right', render: (c) => c.totalConsumed.toString() },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    STAR: 'Estrela',
    PLOWHORSE: 'Cavalo de Carga',
    PUZZLE: 'Enigma',
    DOG: 'Cão',
  };
  const CATEGORY_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
    STAR: 'success',
    PLOWHORSE: 'warning',
    PUZZLE: 'neutral',
    DOG: 'danger',
  };

  const menuColumns: DataTableColumn<MenuEngineeringMatrix['items'][number]>[] = [
    { key: 'name', header: 'Produto', render: (i) => <span className="font-medium">{i.productName}</span> },
    {
      key: 'category',
      header: 'Categoria',
      render: (i) => <StatusBadge label={CATEGORY_LABELS[i.category]} tone={CATEGORY_TONE[i.category]} />,
    },
    { key: 'popularity', header: 'Vendido no período', align: 'right', render: (i) => i.popularity.toString() },
    {
      key: 'margin',
      header: 'Margem de contribuição',
      align: 'right',
      render: (i) => <MoneyValue value={i.contributionMargin} />,
    },
    {
      key: 'drift',
      header: 'Deriva de custo',
      align: 'right',
      render: (i) =>
        i.needsAttention ? (
          <span className="flex items-center justify-end gap-1 text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> {i.driftPercentage.toFixed(1)}%
          </span>
        ) : (
          <span className="text-muted-foreground">{i.driftPercentage.toFixed(1)}%</span>
        ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="BI / Indicadores"
        description="Consumo de ingredientes, análise de preços por fornecedor e engenharia de cardápio."
      />

      <div className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <p className="text-sm font-medium text-foreground">Consumo de ingredientes no período</p>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="range-from">De</Label>
              <Input
                id="range-from"
                type="date"
                value={from.slice(0, 10)}
                onChange={(e) => setRange({ from: new Date(e.target.value).toISOString(), to })}
              />
            </div>
            <div>
              <Label htmlFor="range-to">Até</Label>
              <Input
                id="range-to"
                type="date"
                value={to.slice(0, 10)}
                onChange={(e) => setRange({ from, to: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
        </div>

        {consumptionError && <EmptyState title="Não foi possível carregar" description={consumptionError} />}

        {!consumptionError &&
          consumption &&
          (consumption.length === 0 ? (
            <EmptyState
              title="Nenhum consumo registrado no período"
              description="Consumo reflete saídas de estoque por venda ou ajuste manual."
            />
          ) : (
            <DataTable columns={consumptionColumns} data={consumption} rowKey={(c) => c.ingredientId} />
          ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">Análise de fornecedores por ingrediente</p>

        <div className="mb-4 max-w-sm">
          <Label htmlFor="analysis-ingredient">Ingrediente</Label>
          <Select
            id="analysis-ingredient"
            value={selectedIngredientId}
            onChange={(e) => setSelectedIngredientId(e.target.value)}
          >
            <option value="">Selecione um ingrediente…</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>

        {analysisError && <EmptyState title="Não foi possível carregar" description={analysisError} />}

        {!selectedIngredientId && !analysisError && (
          <EmptyState
            title="Selecione um ingrediente"
            description="Escolha um ingrediente acima para ver histórico de preço e fornecedores vinculados."
          />
        )}

        {supplierAnalysis && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo médio cadastrado</span>
                  {supplierAnalysis.custoMedio ? <MoneyValue value={supplierAnalysis.custoMedio} /> : <span>—</span>}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último custo</span>
                  {supplierAnalysis.ultimoCusto ? <MoneyValue value={supplierAnalysis.ultimoCusto} /> : <span>—</span>}
                </div>
                {supplierAnalysis.variacaoPreco && (
                  <>
                    <div className="mt-2 flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Menor preço pago</span>
                      <MoneyValue value={supplierAnalysis.variacaoPreco.min} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Maior preço pago</span>
                      <MoneyValue value={supplierAnalysis.variacaoPreco.max} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço médio pago</span>
                      <MoneyValue value={supplierAnalysis.variacaoPreco.average} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fornecedores vinculados</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0">
                {supplierAnalysis.fornecedoresVinculados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum fornecedor vinculado a este ingrediente.</p>
                ) : (
                  supplierAnalysis.fornecedoresVinculados.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-sm">
                      <span className="text-foreground">{l.supplier.name}</span>
                      {l.isPreferred && (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          <Star className="h-3 w-3 fill-primary" /> Preferencial
                        </span>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de preços</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0 text-sm">
                {supplierAnalysis.historicoPrecos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma compra confirmada ainda.</p>
                ) : (
                  supplierAnalysis.historicoPrecos.slice(0, 6).map((h, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-foreground">{h.supplierName}</span>
                      <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                        <MoneyValue value={h.unitPrice} />
                        <span className="text-xs">{new Date(h.purchaseDate).toLocaleDateString('pt-BR')}</span>
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Engenharia de Cardápio</p>
            <p className="text-xs text-muted-foreground">
              Classificação de cada produto por popularidade × margem, no mesmo período selecionado acima.
              Margem aqui é bruta — ainda não desconta a comissão real do iFood (depende da homologação
              financeira, ainda pendente).
            </p>
          </div>
          <div>
            <Label htmlFor="drift-threshold">Limite de deriva de custo (%)</Label>
            <Input
              id="drift-threshold"
              type="number"
              min="1"
              value={driftThreshold}
              onChange={(e) => setDriftThreshold(e.target.value)}
              className="w-28"
            />
          </div>
        </div>

        {menuMatrixError && <EmptyState title="Não foi possível carregar" description={menuMatrixError} />}

        {!menuMatrixError && menuMatrix && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Média do cardápio no período: {menuMatrix.averagePopularity.toFixed(1)} unidades vendidas ·{' '}
              <MoneyValue value={menuMatrix.averageContributionMargin} /> de margem
            </p>
            {menuMatrix.items.length === 0 ? (
              <EmptyState
                title="Nenhum produto com ficha técnica ativa"
                description="Cadastre uma ficha técnica para pelo menos um produto ativo para ver a matriz."
              />
            ) : (
              <DataTable columns={menuColumns} data={menuMatrix.items} rowKey={(i) => i.productId} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

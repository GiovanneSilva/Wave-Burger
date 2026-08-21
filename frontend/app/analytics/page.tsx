'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { MoneyValue } from '@/components/wave/money-value';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/auth-provider';
import type { ConsumptionItem, SupplierAnalysis, Ingredient } from '@/lib/types';

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

  return (
    <AppShell>
      <PageHeader
        title="BI / Indicadores"
        description="Consumo de ingredientes e análise de preços por fornecedor."
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
    </AppShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogSyncResult, InventorySyncResult } from '@/lib/types';

export default function SettingsPage() {
  const [merchantId, setMerchantId] = useState('');
  const [savedMerchantId, setSavedMerchantId] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<CatalogSyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ifood/settings')
      .then((res) => (res.ok ? res.json() : { ifoodMerchantId: null }))
      .then((data) => {
        setMerchantId(data.ifoodMerchantId ?? '');
        setSavedMerchantId(data.ifoodMerchantId ?? null);
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  async function handleSaveMerchantId() {
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const res = await fetch('/api/ifood/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ifoodMerchantId: merchantId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível salvar.' }));
        setSaveError(body.message);
        return;
      }

      const data = await res.json();
      setSavedMerchantId(data.ifoodMerchantId);
      setSaveSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncError(null);
    setResults(null);

    if (!savedMerchantId) {
      setSyncError('Salve o ID da loja acima antes de sincronizar.');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/ifood/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: savedMerchantId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível sincronizar.' }));
        setSyncError(body.message);
        return;
      }

      setResults(await res.json());
    } finally {
      setSyncing(false);
    }
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failureCount = results ? results.length - successCount : 0;

  const [inventorySyncing, setInventorySyncing] = useState(false);
  const [inventoryResults, setInventoryResults] = useState<InventorySyncResult[] | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  async function handleInventorySync() {
    setInventoryError(null);
    setInventoryResults(null);

    if (!savedMerchantId) {
      setInventoryError('Salve o ID da loja acima antes de sincronizar.');
      return;
    }

    setInventorySyncing(true);
    try {
      const res = await fetch('/api/ifood/inventory/sync', { method: 'POST' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível sincronizar o inventário.' }));
        setInventoryError(body.message);
        return;
      }

      setInventoryResults(await res.json());
    } finally {
      setInventorySyncing(false);
    }
  }

  const inventorySuccessCount = inventoryResults?.filter((r) => r.success).length ?? 0;
  const inventoryFailureCount = inventoryResults ? inventoryResults.length - inventorySuccessCount : 0;

  return (
    <AppShell>
      <PageHeader title="Configurações" description="Integrações e preferências gerais do sistema." />

      <div className="flex flex-col gap-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Loja no iFood</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <p className="text-sm text-muted-foreground">
              O ID da loja (merchant) precisa ficar salvo — é usado tanto para sincronizar o catálogo
              quanto para o recebimento automático de pedidos, que roda sozinho em segundo plano a cada
              30 segundos assim que houver uma loja configurada aqui.
            </p>

            <div className="max-w-xs">
              <Label htmlFor="merchant-id">ID da loja (merchant) no iFood</Label>
              <Input
                id="merchant-id"
                value={merchantId}
                onChange={(e) => {
                  setMerchantId(e.target.value);
                  setSaveSuccess(false);
                }}
                placeholder="Ex.: 1a2b3c4d-..."
                disabled={loadingSettings}
              />
            </div>

            {saveError && <p className="text-sm text-danger">{saveError}</p>}
            {saveSuccess && (
              <p className="flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Salvo.
              </p>
            )}

            <Button onClick={handleSaveMerchantId} disabled={saving || loadingSettings} className="self-start">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Integração iFood — Catálogo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <p className="text-sm text-muted-foreground">
              Envia os produtos ativos do Wave Burger para o cardápio da loja no iFood. Requer que as
              credenciais do iFood já estejam configuradas no servidor (variáveis de ambiente{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">IFOOD_CLIENT_ID</code>/
              <code className="rounded bg-muted px-1 py-0.5 text-xs">IFOOD_CLIENT_SECRET</code>) e o ID
              da loja acima já esteja salvo.
            </p>

            {syncError && <p className="text-sm text-danger">{syncError}</p>}

            <Button onClick={handleSync} disabled={syncing} className="self-start">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando…' : 'Sincronizar catálogo agora'}
            </Button>

            {results && (
              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  {successCount} sincronizado{successCount === 1 ? '' : 's'}, {failureCount} falhou
                  {failureCount === 1 ? '' : 'ram'}
                </p>

                {results.length === 0 ? (
                  <EmptyState
                    title="Nenhum produto ativo para sincronizar"
                    description="Ative pelo menos um produto (com ficha técnica válida) antes de sincronizar o catálogo."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.map((r) => (
                      <div key={r.productId} className="flex items-start gap-2 text-sm">
                        {r.success ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        )}
                        <div>
                          <span className="text-foreground">{r.productName}</span>
                          {!r.success && r.error && <p className="text-xs text-danger">{r.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Integração iFood — Inventário</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <p className="text-sm text-muted-foreground">
              Envia &quot;quanto dá pra entregar hoje&quot; (Dashboard) pro iFood — quando a quantidade chega a
              zero, o item é pausado automaticamente lá, sem precisar de nenhuma ação manual. Roda
              sozinho a cada 5 minutos; o botão abaixo dispara uma sincronização imediata.
            </p>

            {inventoryError && <p className="text-sm text-danger">{inventoryError}</p>}

            <Button onClick={handleInventorySync} disabled={inventorySyncing} className="self-start">
              <RefreshCw className={`h-4 w-4 ${inventorySyncing ? 'animate-spin' : ''}`} />
              {inventorySyncing ? 'Sincronizando…' : 'Sincronizar inventário agora'}
            </Button>

            {inventoryResults && (
              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  {inventorySuccessCount} sincronizado{inventorySuccessCount === 1 ? '' : 's'},{' '}
                  {inventoryFailureCount} falhou{inventoryFailureCount === 1 ? '' : 'ram'}
                </p>

                {inventoryResults.length === 0 ? (
                  <EmptyState
                    title="Nenhum produto ativo para sincronizar"
                    description="Ative pelo menos um produto antes de sincronizar o inventário."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {inventoryResults.map((r) => (
                      <div key={r.productId} className="flex items-start gap-2 text-sm">
                        {r.success ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                        )}
                        <div>
                          <span className="text-foreground">
                            {r.productName} — {r.quantity} un.
                          </span>
                          {!r.success && r.error && <p className="text-xs text-danger">{r.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

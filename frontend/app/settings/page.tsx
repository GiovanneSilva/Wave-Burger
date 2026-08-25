'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogSyncResult } from '@/lib/types';

export default function SettingsPage() {
  const [merchantId, setMerchantId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<CatalogSyncResult[] | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSync() {
    setGeneralError(null);
    setResults(null);

    if (!merchantId) {
      setGeneralError('Informe o ID da loja (merchant) no iFood.');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/ifood/catalog/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível sincronizar.' }));
        setGeneralError(body.message);
        return;
      }

      setResults(await res.json());
    } finally {
      setSyncing(false);
    }
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failureCount = results ? results.length - successCount : 0;

  return (
    <AppShell>
      <PageHeader title="Configurações" description="Integrações e preferências gerais do sistema." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Integração iFood — Catálogo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Envia os produtos ativos do Wave Burger para o cardápio da loja no iFood. Requer que as
            credenciais do iFood já estejam configuradas no servidor (variáveis de ambiente{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">IFOOD_CLIENT_ID</code>/
            <code className="rounded bg-muted px-1 py-0.5 text-xs">IFOOD_CLIENT_SECRET</code>) — se
            ainda não completou o cadastro no Portal Developer do iFood, a sincronização vai mostrar
            um erro claro explicando isso.
          </p>

          <div className="max-w-xs">
            <Label htmlFor="merchant-id">ID da loja (merchant) no iFood</Label>
            <Input
              id="merchant-id"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="Ex.: 1a2b3c4d-..."
            />
          </div>

          {generalError && <p className="text-sm text-danger">{generalError}</p>}

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
    </AppShell>
  );
}

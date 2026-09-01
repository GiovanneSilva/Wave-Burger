'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { EmptyState } from '@/components/wave/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogSyncResult, IfoodUserCodeResult } from '@/lib/types';

function IfoodAuthorizationCard() {
  const [requesting, setRequesting] = useState(false);
  const [userCodeResult, setUserCodeResult] = useState<IfoodUserCodeResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [authorizationCode, setAuthorizationCode] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  async function handleRequestCode() {
    setRequestError(null);
    setUserCodeResult(null);
    setAuthorized(false);

    setRequesting(true);
    try {
      const res = await fetch('/api/ifood/auth/request-user-code', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível solicitar o código.' }));
        setRequestError(body.message);
        return;
      }
      setUserCodeResult(await res.json());
    } finally {
      setRequesting(false);
    }
  }

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    setAuthorizeError(null);

    if (!authorizationCode) {
      setAuthorizeError('Cole o código de autorização que o iFood te deu depois de clicar em "Autorizar".');
      return;
    }

    setAuthorizing(true);
    try {
      const res = await fetch('/api/ifood/auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível confirmar a autorização.' }));
        setAuthorizeError(body.message);
        return;
      }

      setAuthorized(true);
      setUserCodeResult(null);
      setAuthorizationCode('');
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Autorizar aplicativo iFood</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <p className="text-sm text-muted-foreground">
          Passo único, feito uma vez: autoriza o Wave Burger a acessar sua loja no iFood. Depois disso,
          a renovação é automática — não precisa repetir.
        </p>

        {authorized && (
          <div className="flex items-center gap-2 rounded-md bg-success-bg p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Autorização confirmada com sucesso.
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">1. Solicitar código</p>
          <Button variant="secondary" onClick={handleRequestCode} disabled={requesting} className="self-start">
            <RefreshCw className={`h-4 w-4 ${requesting ? 'animate-spin' : ''}`} />
            {requesting ? 'Solicitando…' : 'Solicitar código'}
          </Button>
          {requestError && <p className="mt-2 text-sm text-danger">{requestError}</p>}
        </div>

        {userCodeResult && (
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Acesse o link abaixo e digite este código:</p>
            <p className="my-2 text-2xl font-bold tracking-wider text-foreground">{userCodeResult.userCode}</p>
            <a
              href={userCodeResult.verificationUrlComplete}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary underline"
            >
              Abrir página de autorização do iFood <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="mt-2 text-xs text-muted-foreground">
              Expira em {Math.round(userCodeResult.expiresInSeconds / 60)} minutos. Depois de clicar em
              &quot;Autorizar&quot; lá no iFood, volte aqui e cole o código que ele te der no passo 2.
            </p>
          </div>
        )}

        <form onSubmit={handleAuthorize} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">2. Confirmar autorização</p>
          <div className="flex items-end gap-2">
            <div className="max-w-xs flex-1">
              <Label htmlFor="authorization-code">Código de autorização</Label>
              <Input
                id="authorization-code"
                value={authorizationCode}
                onChange={(e) => setAuthorizationCode(e.target.value)}
                placeholder="Ex.: LHQX-ZZZZ"
              />
            </div>
            <Button type="submit" disabled={authorizing}>
              {authorizing ? 'Confirmando…' : 'Confirmar autorização'}
            </Button>
          </div>
          {authorizeError && <p className="text-sm text-danger">{authorizeError}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function IfoodCatalogSyncCard() {
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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Integração iFood — Catálogo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <p className="text-sm text-muted-foreground">
          Envia os produtos ativos do Wave Burger para o cardápio da loja no iFood. Requer que a
          autorização acima já tenha sido confirmada.
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
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title="Configurações" description="Integrações e preferências gerais do sistema." />

      <div className="flex flex-col gap-6">
        <IfoodAuthorizationCard />
        <IfoodCatalogSyncCard />
      </div>
    </AppShell>
  );
}

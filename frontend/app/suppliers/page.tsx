'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { DataTable, type DataTableColumn } from '@/components/wave/data-table';
import { StatusBadge } from '@/components/wave/status-badge';
import { EmptyState } from '@/components/wave/empty-state';
import { ConfirmDialog } from '@/components/wave/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toToggle, setToToggle] = useState<Supplier | null>(null);
  const [toggling, setToggling] = useState(false);

  async function load() {
    setError(null);
    const res = await fetch('/api/suppliers');
    if (!res.ok) {
      setError('Não foi possível carregar os fornecedores.');
      return;
    }
    setSuppliers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name) {
      setFormError('Nome é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          paymentTerms: paymentTerms || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível criar.' }));
        setFormError(body.message);
        return;
      }

      setName('');
      setContactName('');
      setContactPhone('');
      setPaymentTerms('');
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleConfirm() {
    if (!toToggle) return;
    setToggling(true);
    try {
      const action = toToggle.isActive ? 'deactivate' : 'activate';
      const res = await fetch(`/api/suppliers/${toToggle.id}/${action}`, { method: 'PATCH' });
      if (res.ok) {
        setToToggle(null);
        await load();
      }
    } finally {
      setToggling(false);
    }
  }

  const columns: DataTableColumn<Supplier>[] = [
    { key: 'name', header: 'Nome', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'contact', header: 'Contato', render: (s) => s.contactName ?? '—' },
    { key: 'phone', header: 'Telefone', render: (s) => s.contactPhone ?? '—' },
    { key: 'terms', header: 'Condições de pagamento', render: (s) => s.paymentTerms ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <StatusBadge label={s.isActive ? 'Ativo' : 'Inativo'} tone={s.isActive ? 'success' : 'neutral'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setToToggle(s);
          }}
        >
          {s.isActive ? 'Inativar' : 'Ativar'}
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Fornecedores"
        description="Cadastro de fornecedores e vínculo com os ingredientes que eles fornecem."
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? 'Cancelar' : 'Novo fornecedor'}
          </Button>
        }
      />

      {formOpen && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <Label htmlFor="sup-name">Nome</Label>
                <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Frigorífico Central" />
              </div>
              <div>
                <Label htmlFor="sup-contact">Contato</Label>
                <Input id="sup-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="sup-phone">Telefone</Label>
                <Input id="sup-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <Label htmlFor="sup-terms">Condições de pagamento</Label>
                <Input id="sup-terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Ex.: 30 dias" />
              </div>

              <div className="flex items-end gap-2 md:col-span-4">
                {formError && <p className="mr-auto text-sm text-danger">{formError}</p>}
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Criar fornecedor'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <EmptyState title="Não foi possível carregar" description={error} className="mb-4" />}

      {suppliers === null && !error ? (
        <p className="text-sm text-muted-foreground">Carregando fornecedores…</p>
      ) : (
        suppliers && (
          <DataTable
            columns={columns}
            data={suppliers}
            rowKey={(s) => s.id}
            onRowClick={(s) => router.push(`/suppliers/${s.id}`)}
            emptyTitle="Nenhum fornecedor ainda"
            emptyDescription="Cadastre o primeiro fornecedor para vincular aos ingredientes."
          />
        )
      )}

      <ConfirmDialog
        open={toToggle !== null}
        onOpenChange={(open) => !open && setToToggle(null)}
        title={toToggle?.isActive ? 'Inativar fornecedor?' : 'Ativar fornecedor?'}
        description={
          toToggle?.isActive
            ? `${toToggle?.name} deixará de aparecer como opção ativa. O histórico é mantido.`
            : `${toToggle?.name} volta a ficar disponível.`
        }
        confirmLabel={toToggle?.isActive ? 'Inativar' : 'Ativar'}
        destructive={toToggle?.isActive}
        onConfirm={handleToggleConfirm}
        loading={toggling}
      />
    </AppShell>
  );
}

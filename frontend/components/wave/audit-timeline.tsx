import { cn } from '@/lib/utils';

export interface AuditTimelineEntry {
  id: string;
  action: string;
  userName?: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

interface AuditTimelineProps {
  entries: AuditTimelineEntry[];
  className?: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'criou',
  UPDATE: 'editou',
  ACTIVATE: 'ativou',
  DEACTIVATE: 'inativou',
  CREATE_VERSION: 'criou nova versão da ficha técnica',
  STOCK_ENTRY: 'registrou entrada de estoque',
  STOCK_EXIT: 'registrou saída de estoque',
  MARK_AS_PAID: 'marcou como pago',
  CANCEL: 'cancelou',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/// Linha do tempo de auditoria — consome diretamente o AuditLog do
/// backend (Etapa 7, mecanismo central e reutilizável). Serve tanto para
/// segurança quanto para diagnóstico ("por que a margem desse produto
/// caiu?"), conforme a Seção 9 do Documento Mestre.
export function AuditTimeline({ entries, className }: AuditTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>;
  }

  return (
    <ol className={cn('flex flex-col gap-4', className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <div>
            <p className="text-foreground">
              <span className="font-medium">{entry.userName ?? 'Sistema'}</span>{' '}
              {ACTION_LABELS[entry.action] ?? entry.action.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

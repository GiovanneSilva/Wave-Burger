import { cn } from '@/lib/utils';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  className?: string;
}

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-primary/10 text-primary',
};

const dotStyles: Record<StatusTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-primary',
};

/// Badge discreto de status (● Ativo / ● Rascunho / ● Inativo etc.) —
/// nunca pinta a linha/card inteiro, só o indicador, conforme o brief de
/// design ("nada de pintar a linha inteira de vermelho").
export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        toneStyles[tone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}

/// Mapeamentos prontos para os enums do backend, evitando decidir a cor
/// certa toda vez que um status é renderizado numa tela diferente.
export const PRODUCT_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  ACTIVE: { label: 'Ativo', tone: 'success' },
  INACTIVE: { label: 'Inativo', tone: 'danger' },
};

export const PURCHASE_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Rascunho', tone: 'neutral' },
  CONFIRMED: { label: 'Confirmada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const FINANCIAL_ENTRY_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Pendente', tone: 'warning' },
  PAID: { label: 'Pago', tone: 'success' },
  OVERDUE: { label: 'Vencido', tone: 'danger' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
};

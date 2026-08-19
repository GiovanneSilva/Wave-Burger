import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';

interface MoneyValueProps {
  value: number | string;
  className?: string;
  tone?: 'default' | 'success' | 'danger';
}

/// Formata valores monetários de forma consistente (pt-BR, BRL) em toda
/// a aplicação. Nunca formate valor monetário manualmente fora deste
/// componente — evita divergência de formatação entre telas.
export function MoneyValue({ value, className, tone = 'default' }: MoneyValueProps) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-success',
    danger: 'text-danger',
  }[tone];

  return <span className={cn('tabular-nums', toneClass, className)}>{formatMoney(value)}</span>;
}

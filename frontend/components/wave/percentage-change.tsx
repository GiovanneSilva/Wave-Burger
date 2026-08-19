import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercentage } from '@/lib/format';

interface PercentageChangeProps {
  value: number;
  /// Quando true, um valor positivo é "ruim" (ex.: CMV subiu) — inverte
  /// as cores semânticas sem inverter o número exibido.
  invertColors?: boolean;
  className?: string;
}

/// Mostra uma variação percentual com seta e cor semântica. Usado em
/// KpiCard para dar contexto ("31,4% ↑ 2,1% vs. mês anterior").
export function PercentageChange({ value, invertColors = false, className }: PercentageChangeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const isGood = invertColors ? !isPositive : isPositive;

  const colorClass = isNeutral ? 'text-muted-foreground' : isGood ? 'text-success' : 'text-danger';
  const Icon = isNeutral ? Minus : isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', colorClass, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatPercentage(Math.abs(value))}
    </span>
  );
}

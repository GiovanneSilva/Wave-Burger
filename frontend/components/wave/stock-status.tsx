import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StockLevel = 'normal' | 'attention' | 'critical';

interface StockStatusProps {
  currentQuantity: number;
  minimumStock: number | null;
  className?: string;
}

/// Classifica o saldo de estoque em 3 estados (RF-018/BR-011). "Atenção"
/// é a faixa entre o mínimo e 20% acima dele — dá um aviso antes de
/// virar crítico, sem esperar cruzar a linha exata.
function classify(current: number, minimum: number | null): StockLevel {
  if (minimum === null) return 'normal';
  if (current < minimum) return 'critical';
  if (current < minimum * 1.2) return 'attention';
  return 'normal';
}

const config: Record<StockLevel, { label: string; className: string; icon: typeof CheckCircle2 | null }> = {
  normal: { label: 'Normal', className: 'text-success', icon: null },
  attention: { label: 'Atenção', className: 'text-warning', icon: AlertTriangle },
  critical: { label: 'Crítico', className: 'text-danger', icon: AlertTriangle },
};

/// Indicador lateral de estoque — nunca pinta a linha inteira, só o
/// texto/ícone (mesmo princípio de StatusBadge), conforme o brief:
/// "deixa a tela muito menos cansativa".
export function StockStatus({ currentQuantity, minimumStock, className }: StockStatusProps) {
  const level = classify(currentQuantity, minimumStock);
  const { label, className: toneClass, icon: Icon } = config[level];

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', toneClass, className)}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}

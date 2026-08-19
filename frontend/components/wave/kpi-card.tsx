import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PercentageChange } from './percentage-change';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;
  changeInvertColors?: boolean;
  changeLabel?: string;
  href?: string;
  className?: string;
}

/// Card de indicador do dashboard executivo (RF-025). Quando `href` é
/// informado, o card inteiro é clicável — segue o padrão indicador →
/// detalhe → causa → ação definido no brief de design: um número sozinho
/// não ajuda a decidir, o caminho até a causa sim.
export function KpiCard({ label, value, change, changeInvertColors, changeLabel, href, className }: KpiCardProps) {
  const content = (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-subtle transition-colors',
        href && 'hover:border-primary/40 cursor-pointer',
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-medium text-foreground tabular-nums">{value}</p>
      {change !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <PercentageChange value={change} invertColors={changeInvertColors} />
          {changeLabel && <span className="text-xs text-muted-foreground">{changeLabel}</span>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

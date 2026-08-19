import { ReactNode } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from './empty-state';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /// Alinha a coluna à direita — usado para números/valores monetários.
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

/// Tabela de dados genérica — a base de Produtos, Estoque, Compras,
/// Fornecedores, Lançamentos financeiros etc. Evita reimplementar a
/// mesma marcação de tabela em cada tela (brief de design: "para
/// gestão, tabela funciona melhor" que cards grandes com foto).
export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription = 'Os registros aparecem aqui assim que forem criados.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
                {col.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

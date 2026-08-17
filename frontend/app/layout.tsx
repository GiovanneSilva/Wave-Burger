import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wave Burger',
  description: 'Plataforma de gestão inteligente para hamburgueria',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

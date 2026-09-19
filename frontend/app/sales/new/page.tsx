'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/wave/page-header';
import { MoneyValue } from '@/components/wave/money-value';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/auth/auth-provider';
import type { Product, Sale } from '@/lib/types';

export default function NewSalePage() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discountType, setDiscountType] = useState<'' | 'PERCENTAGE' | 'FIXED'>('');
  const [discountValue, setDiscountValue] = useState('');

  // Pedidos por fora do iFood — todos opcionais, de propósito
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [salesChannel, setSalesChannel] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [marketingCampaignCode, setMarketingCampaignCode] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Sale | null>(null);

  useEffect(() => {
    fetch('/api/products').then(async (res) => {
      if (res.ok) {
        const all: Product[] = await res.json();
        setProducts(all.filter((p) => p.status === 'ACTIVE'));
      }
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const grossPreview =
    selectedProduct?.salePrice && quantity ? Number(selectedProduct.salePrice) * Number(quantity) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!productId || !quantity) {
      setError('Selecione o produto e informe a quantidade.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessUnitId: user?.businessUnitId,
          productId,
          quantity,
          discountType: discountType || undefined,
          discountValue: discountType ? discountValue : undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
          customerNeighborhood: customerNeighborhood || undefined,
          customerPostalCode: customerPostalCode || undefined,
          salesChannel: salesChannel || undefined,
          paymentMethod: paymentMethod || undefined,
          marketingCampaignCode: marketingCampaignCode || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Não foi possível registrar a venda.' }));
        setError(body.message);
        return;
      }

      const sale: Sale = await res.json();
      setResult(sale);
      setQuantity('1');
      setDiscountType('');
      setDiscountValue('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerNeighborhood('');
      setCustomerPostalCode('');
      setSalesChannel('');
      setPaymentMethod('');
      setMarketingCampaignCode('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Nova venda" description="Consome o estoque automaticamente segundo a ficha técnica do produto." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="sale-product">Produto</Label>
                <Select id="sale-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.salePrice ? `— R$ ${p.salePrice}` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale-quantity">Quantidade</Label>
                  <Input id="sale-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale-discount-type">Desconto</Label>
                  <Select
                    id="sale-discount-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as '' | 'PERCENTAGE' | 'FIXED')}
                  >
                    <option value="">Sem desconto</option>
                    <option value="PERCENTAGE">Percentual (%)</option>
                    <option value="FIXED">Valor fixo (R$)</option>
                  </Select>
                </div>
                {discountType && (
                  <div>
                    <Label htmlFor="sale-discount-value">
                      {discountType === 'PERCENTAGE' ? 'Percentual' : 'Valor (R$)'}
                    </Label>
                    <Input
                      id="sale-discount-value"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="border-t border-border pt-4">
                <p className="mb-1 text-sm font-medium text-foreground">Dados do pedido (opcional)</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Útil para pedidos que vieram por fora do iFood (WhatsApp, telefone, balcão). Nenhum
                  campo aqui é obrigatório.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sale-customer-name">Nome do cliente</Label>
                    <Input id="sale-customer-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sale-customer-phone">Telefone</Label>
                    <Input id="sale-customer-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Usado para reconhecer recompra" />
                  </div>
                  <div>
                    <Label htmlFor="sale-customer-email">E-mail</Label>
                    <Input id="sale-customer-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sale-customer-neighborhood">Bairro</Label>
                    <Input id="sale-customer-neighborhood" value={customerNeighborhood} onChange={(e) => setCustomerNeighborhood(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sale-customer-postal">CEP</Label>
                    <Input id="sale-customer-postal" value={customerPostalCode} onChange={(e) => setCustomerPostalCode(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sale-channel">Canal de venda</Label>
                    <Select id="sale-channel" value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)}>
                      <option value="">Não informado</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="INSTAGRAM">Instagram</option>
                      <option value="TELEFONE">Telefone</option>
                      <option value="PRESENCIAL">Presencial/Balcão</option>
                      <option value="SITE_PROPRIO">Site próprio</option>
                      <option value="OUTRO">Outro</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sale-payment">Método de pagamento</Label>
                    <Select id="sale-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="">Não informado</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CARTAO_DEBITO">Cartão de débito</option>
                      <option value="CARTAO_CREDITO">Cartão de crédito</option>
                      <option value="VALE_REFEICAO">Vale-refeição</option>
                      <option value="OUTRO">Outro</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sale-campaign">Código de campanha</Label>
                    <Input id="sale-campaign" value={marketingCampaignCode} onChange={(e) => setMarketingCampaignCode(e.target.value)} placeholder="Ex.: PRIMEIRA20" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="sale-notes">Observações</Label>
                    <Input id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: sem cebola, entregar na portaria" />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="self-start">
                {saving ? 'Registrando…' : 'Registrar venda'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {grossPreview !== null && !result && (
            <Card>
              <CardContent className="flex flex-col gap-1.5 pt-5 text-sm">
                <p className="font-medium text-foreground">Prévia</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor bruto</span>
                  <MoneyValue value={grossPreview} />
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className={result.hadInsufficientStock ? 'border-warning/40' : 'border-success/40'}>
              <CardContent className="flex flex-col gap-2 pt-5 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {result.hadInsufficientStock ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  Venda registrada
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <MoneyValue value={result.netAmount} />
                </div>

                {result.hadInsufficientStock && result.stockWarnings && (
                  <div className="mt-2 rounded-md bg-warning-bg p-3 text-xs text-foreground">
                    <p className="mb-1 font-medium">Estoque ficou negativo — a venda foi registrada mesmo assim:</p>
                    {result.stockWarnings.map((w) => (
                      <p key={w.ingredientId}>
                        {w.ingredientName}: saldo atual {w.resultingBalance}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

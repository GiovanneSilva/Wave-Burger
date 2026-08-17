import { UnprocessableEntityException } from '@nestjs/common';
import { convertQuantity } from './unit-conversion';

describe('convertQuantity', () => {
  it('converte kg para g (base 1000)', () => {
    expect(convertQuantity(1, 'kg', 'g')).toBe(1000);
  });

  it('converte g para kg (RF-005: 160g -> 0.16kg)', () => {
    expect(convertQuantity(160, 'g', 'kg')).toBeCloseTo(0.16, 10);
  });

  it('converte l para ml', () => {
    expect(convertQuantity(1, 'l', 'ml')).toBe(1000);
  });

  it('converte ml para l', () => {
    expect(convertQuantity(500, 'ml', 'l')).toBeCloseTo(0.5, 10);
  });

  it('não altera valor quando a unidade é a mesma', () => {
    expect(convertQuantity(5, 'un', 'un')).toBe(5);
  });

  it('BLOQUEIA conversão entre famílias diferentes (PD-011 em aberto)', () => {
    expect(() => convertQuantity(1, 'kg', 'un')).toThrow(UnprocessableEntityException);
  });

  it('BLOQUEIA unidade desconhecida', () => {
    expect(() => convertQuantity(1, 'caixa', 'kg')).toThrow(UnprocessableEntityException);
  });
});

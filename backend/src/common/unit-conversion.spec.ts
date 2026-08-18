import { UnprocessableEntityException } from '@nestjs/common';
import { convertPricePerUnit, convertQuantity } from './unit-conversion';

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

describe('convertPricePerUnit', () => {
  it('converte preço por kg para preço por g (RF-009 "último custo")', () => {
    // R$30/kg -> R$0,03/g
    expect(convertPricePerUnit(30, 'kg', 'g')).toBeCloseTo(0.03, 6);
  });

  it('converte preço por g para preço por kg (compra em g, ingrediente padrão kg)', () => {
    // R$0,03/g -> R$30/kg
    expect(convertPricePerUnit(0.03, 'g', 'kg')).toBeCloseTo(30, 4);
  });

  it('não altera o preço quando a unidade é a mesma', () => {
    expect(convertPricePerUnit(30, 'kg', 'kg')).toBe(30);
  });

  it('BLOQUEIA conversão de preço entre famílias diferentes', () => {
    expect(() => convertPricePerUnit(30, 'kg', 'un')).toThrow(UnprocessableEntityException);
  });
});

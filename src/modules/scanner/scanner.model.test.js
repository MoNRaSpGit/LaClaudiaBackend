import { describe, expect, it } from 'vitest';
import {
  normalizeCustomerAccountPaymentPayload,
  normalizeDashboardInitialCashPayload,
  normalizeDashboardParams,
  normalizePaymentPayload,
  normalizeProductCreatePayload,
  normalizeProductUpdatePayload,
  normalizeSalePayload
} from './scanner.model.js';

describe('normalizeDashboardParams', () => {
  it('builds store-day ranges in America/Montevideo for an explicit date', () => {
    const result = normalizeDashboardParams({ date: '2026-04-30' });

    expect(result).toMatchObject({
      dayStart: '2026-04-30 03:00:00',
      dayEnd: '2026-05-01 03:00:00',
      yesterdayStart: '2026-04-29 03:00:00',
      yesterdayEnd: '2026-04-30 03:00:00',
      dateLabel: '2026-04-30',
      initialCash: 0,
      hasInitialCashOverride: false,
      profitRate: 0.4,
      movementLimit: 100,
      rankingLimit: 20
    });
  });

  it('captures initial cash override when provided', () => {
    const result = normalizeDashboardParams({
      date: '2026-04-30',
      initialCash: '1500.5',
      profitRate: '0.35',
      movementLimit: '150',
      rankingLimit: '40'
    });

    expect(result.initialCash).toBe(1500.5);
    expect(result.hasInitialCashOverride).toBe(true);
    expect(result.profitRate).toBe(0.35);
    expect(result.movementLimit).toBe(150);
    expect(result.rankingLimit).toBe(40);
  });
});

describe('normalizeDashboardInitialCashPayload', () => {
  it('normalizes valid payloads', () => {
    expect(
      normalizeDashboardInitialCashPayload(
        { date: '2026-04-30', initialCash: '2500.75' },
        {}
      )
    ).toEqual({
      dateLabel: '2026-04-30',
      initialCash: 2500.75
    });
  });

  it('falls back to query date when payload date is missing', () => {
    expect(
      normalizeDashboardInitialCashPayload(
        { initialCash: '800' },
        { date: '2026-04-30' }
      )
    ).toEqual({
      dateLabel: '2026-04-30',
      initialCash: 800
    });
  });

  it('rejects invalid initial cash values', () => {
    expect(() => normalizeDashboardInitialCashPayload({ initialCash: '-1' }, {})).toThrow('initialCash invalido');
    expect(() => normalizeDashboardInitialCashPayload({ initialCash: 'abc' }, {})).toThrow('initialCash invalido');
  });
});

describe('normalizeSalePayload', () => {
  it('normalizes valid sale items and totals', () => {
    const result = normalizeSalePayload({
      externalId: 'sale-1',
      userId: 12,
      paymentMethod: 'tarjeta',
      customerId: null,
      notes: 'Venta de prueba',
      items: [
        {
          nombre: 'Yerba',
          precio_venta: '100.50',
          quantity: '2',
          productId: 44,
          thumbnail_url: 'https://example.com/product.jpg'
        },
        {
          nombre: 'Manual',
          precio_venta: 50,
          quantity: 1,
          isManual: true
        }
      ]
    });

    expect(result.external_id).toBe('sale-1');
    expect(result.user_id).toBe(12);
    expect(result.sale_payment_method).toBe('tarjeta');
    expect(result.items_count).toBe(3);
    expect(result.total_amount).toBe(251);
    expect(result.items).toEqual([
      {
        product_id: 44,
        is_manual: 0,
        product_name: 'Yerba',
        unit_price: 100.5,
        quantity: 2,
        line_total: 201,
        thumbnail_url: 'https://example.com/product.jpg'
      },
      {
        product_id: null,
        is_manual: 1,
        product_name: 'Manual',
        unit_price: 50,
        quantity: 1,
        line_total: 50,
        thumbnail_url: null
      }
    ]);
  });

  it('rejects empty sale items', () => {
    expect(() => normalizeSalePayload({ items: [] })).toThrow('La venta debe incluir al menos un item');
  });

  it('falls back to efectivo when paymentMethod is unknown', () => {
    const result = normalizeSalePayload({
      paymentMethod: 'transferencia',
      items: [
        {
          nombre: 'Yerba',
          precio_venta: 100,
          quantity: 1
        }
      ]
    });

    expect(result.sale_payment_method).toBe('efectivo');
  });

  it('maps debito and credito to tarjeta', () => {
    const debito = normalizeSalePayload({
      paymentMethod: 'debito',
      items: [{ nombre: 'Yerba', precio_venta: 100, quantity: 1 }]
    });
    const credito = normalizeSalePayload({
      paymentMethod: 'credito',
      items: [{ nombre: 'Cafe', precio_venta: 200, quantity: 1 }]
    });

    expect(debito.sale_payment_method).toBe('tarjeta');
    expect(credito.sale_payment_method).toBe('tarjeta');
  });

  it('requires customerId for ventas en cuenta', () => {
    expect(() => normalizeSalePayload({
      paymentMethod: 'cuenta',
      items: [{ nombre: 'Yerba', precio_venta: 100, quantity: 1 }]
    })).toThrow('customerId requerido para ventas en cuenta');
  });
});

describe('customer payloads', () => {
  it('normalizes valid customer payloads', async () => {
    const { normalizeCustomerCreatePayload, normalizeCustomerId } = await import('./scanner.model.js');

    expect(normalizeCustomerCreatePayload({
      name: 'Juan Perez',
      phone: '099123123',
      notes: 'Compra en cuenta'
    })).toEqual({
      name: 'Juan Perez',
      phone: '099123123',
      notes: 'Compra en cuenta'
    });

    expect(normalizeCustomerId('7')).toBe(7);
  });

  it('normalizes customer account payments', () => {
    expect(normalizeCustomerAccountPaymentPayload({
      externalId: 'cap-1',
      customerId: '7',
      userId: '2',
      paymentMethod: 'credito',
      amount: '450.50',
      notes: 'Pago parcial'
    })).toEqual({
      external_id: 'cap-1',
      customer_id: 7,
      user_id: 2,
      payment_method: 'tarjeta',
      amount: 450.5,
      notes: 'Pago parcial'
    });
  });

  it('rejects invalid customer account payments', () => {
    expect(() => normalizeCustomerAccountPaymentPayload({
      customerId: '',
      amount: '10'
    })).toThrow('customerId invalido');
    expect(() => normalizeCustomerAccountPaymentPayload({
      customerId: '2',
      amount: '0'
    })).toThrow('Monto de pago invalido');
  });
});

describe('normalizePaymentPayload', () => {
  it('normalizes valid payment payloads', () => {
    expect(
      normalizePaymentPayload({
        externalId: 'pay-1',
        userId: '7',
        amount: '900.25',
        description: 'Proveedor'
      })
    ).toEqual({
      external_id: 'pay-1',
      user_id: 7,
      amount: 900.25,
      description: 'Proveedor'
    });
  });

  it('rejects invalid payment amounts', () => {
    expect(() => normalizePaymentPayload({ amount: 0 })).toThrow('Monto de pago invalido');
  });
});

describe('normalizeProductUpdatePayload', () => {
  it('normalizes valid product updates', () => {
    expect(
      normalizeProductUpdatePayload('5', {
        nombre: 'Cafe',
        precio_venta: '345.99',
        thumbnail_url: 'https://example.com/cafe.jpg'
      })
    ).toEqual({
      productId: 5,
      nombre: 'Cafe',
      precio_venta: 345.99,
      thumbnail_url: 'https://example.com/cafe.jpg'
    });
  });

  it('rejects invalid update data', () => {
    expect(() => normalizeProductUpdatePayload('0', { nombre: 'X', precio_venta: 10 })).toThrow('productId invalido');
    expect(() => normalizeProductUpdatePayload('4', { nombre: '', precio_venta: 10 })).toThrow('nombre requerido');
    expect(() => normalizeProductUpdatePayload('4', { nombre: 'X', precio_venta: 0 })).toThrow('precio_venta invalido');
  });
});

describe('normalizeProductCreatePayload', () => {
  it('normalizes valid product creations', () => {
    expect(
      normalizeProductCreatePayload({
        barcode: ' 779123 ',
        nombre: 'Coca Cola 600ml',
        precio_venta: '150.50'
      })
    ).toEqual({
      barcode: '779123',
      barcode_normalized: '779123',
      nombre: 'Coca Cola 600ml',
      precio_venta: 150.5,
      categoria: 'manual',
      thumbnail_url: undefined
    });
  });

  it('rejects invalid creation data', () => {
    expect(() => normalizeProductCreatePayload({ nombre: 'X', precio_venta: 10 })).toThrow('barcode requerido');
    expect(() => normalizeProductCreatePayload({ barcode: '779', nombre: '', precio_venta: 10 })).toThrow('nombre requerido');
    expect(() => normalizeProductCreatePayload({ barcode: '779', nombre: 'X', precio_venta: 0 })).toThrow('precio_venta invalido');
  });
});

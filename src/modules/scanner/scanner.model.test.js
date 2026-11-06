import { describe, expect, it } from 'vitest';
import {
  INITIAL_CASH_PRELOAD_OPEN_HOUR,
  annotateAccountSalesSettlement,
  buildCoveredItemsSnapshot,
  getNextStoreDateLabel,
  getStoreDateLabelForDate,
  isInitialCashPreloadWindowOpen,
  normalizeCashDepositPayload,
  normalizeCustomerAccountPaymentPayload,
  normalizeDashboardInitialCashPayload,
  normalizeDashboardParams,
  normalizePaymentPayload,
  normalizeProductCreatePayload,
  normalizeProductUpdatePayload,
  normalizeSalePayload,
  reconcileCustomerAccountPayment,
  selectSalesUpToAmount
} from './scanner.model.js';

describe('normalizeCashDepositPayload', () => {
  it('normaliza un ingreso valido', () => {
    const result = normalizeCashDepositPayload({
      amount: '200.5',
      description: '  Cambio traido de casa  ',
      userId: 3
    });

    expect(result).toEqual({
      external_id: null,
      user_id: 3,
      amount: 200.5,
      description: 'Cambio traido de casa'
    });
  });

  it('rechaza un monto invalido', () => {
    expect(() => normalizeCashDepositPayload({ amount: 0, description: 'algo' })).toThrow(/monto/i);
    expect(() => normalizeCashDepositPayload({ amount: -50, description: 'algo' })).toThrow(/monto/i);
  });

  it('exige un motivo/descripcion', () => {
    expect(() => normalizeCashDepositPayload({ amount: 100, description: '' })).toThrow(/motivo/i);
    expect(() => normalizeCashDepositPayload({ amount: 100 })).toThrow(/motivo/i);
  });
});

describe('annotateAccountSalesSettlement', () => {
  it('marca como saldadas las ventas mas viejas hasta agotar los pagos, y el resto como pendientes', () => {
    const salesAsc = [
      { id: 1, total_amount: 1400, created_at: '2026-04-28 10:00:00' },
      { id: 2, total_amount: 1000, created_at: '2026-04-29 09:00:00' },
      { id: 3, total_amount: 1000, created_at: '2026-04-30 08:00:00' }
    ];

    const annotated = annotateAccountSalesSettlement({ salesAsc, totalPayments: 2400 });

    expect(annotated.map((sale) => ({ id: sale.id, isSettled: sale.isSettled }))).toEqual([
      { id: 1, isSettled: true },
      { id: 2, isSettled: true },
      { id: 3, isSettled: false }
    ]);
  });

  it('con deuda cero, ninguna venta queda pendiente', () => {
    const salesAsc = [{ id: 1, total_amount: 500, created_at: '2026-04-28 10:00:00' }];
    const annotated = annotateAccountSalesSettlement({ salesAsc, totalPayments: 500 });

    expect(annotated[0].isSettled).toBe(true);
  });

  it('usa el mismo criterio FIFO que reconcileCustomerAccountPayment (consistencia ticket <-> pantalla)', () => {
    const salesAsc = [
      { id: 1, total_amount: 1400, created_at: '2026-04-28 10:00:00' },
      { id: 2, total_amount: 1000, created_at: '2026-04-29 09:00:00' },
      { id: 3, total_amount: 1000, created_at: '2026-04-30 08:00:00' }
    ];

    const reconciliation = reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 0,
      paymentAmount: 2400
    });
    const annotated = annotateAccountSalesSettlement({ salesAsc, totalPayments: 2400 });

    const settledIds = annotated.filter((sale) => sale.isSettled).map((sale) => sale.id);
    expect(settledIds).toEqual(reconciliation.coveredSaleIds);
  });
});

describe('reconcileCustomerAccountPayment', () => {
  it('cubre todas las ventas impagas cuando el pago salda la deuda completa', () => {
    const salesAsc = [
      { id: 1, total_amount: 1000, created_at: '2026-04-28 10:00:00' },
      { id: 2, total_amount: 1400, created_at: '2026-04-29 12:00:00' },
      { id: 3, total_amount: 1000, created_at: '2026-04-29 18:00:00' }
    ];

    const result = reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 0,
      paymentAmount: 3400
    });

    expect(result.debtTotal).toBe(3400);
    expect(result.isFullyClosing).toBe(true);
    expect(result.debtRemaining).toBe(0);
    expect(result.coveredSaleIds).toEqual([1, 2, 3]);
  });

  it('usa la deuda real de la DB, no una deuda vieja del frontend: si aparecio una venta nueva, el pago que antes cerraba la cuenta ahora queda parcial', () => {
    // Reproduce el bug reportado: el operador vio $2400 de deuda en pantalla y
    // pago ese monto pensando que cerraba la cuenta, pero justo antes se habia
    // cargado una venta nueva de $1000 que la pantalla todavia no reflejaba.
    // La deuda real en la DB ya es $3400. El pago de $2400 no debe marcarse
    // como "isFullyClosing" ni consumir la venta de hoy.
    const salesAsc = [
      { id: 1, total_amount: 1400, created_at: '2026-04-28 10:00:00' }, // "ayer"
      { id: 2, total_amount: 1000, created_at: '2026-04-29 09:00:00' }, // "ayer"
      { id: 3, total_amount: 1000, created_at: '2026-04-30 08:00:00' } // venta nueva de "hoy", no vista en pantalla
    ];

    const result = reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 0,
      paymentAmount: 2400
    });

    expect(result.debtTotal).toBe(3400);
    expect(result.isFullyClosing).toBe(false);
    expect(result.debtRemaining).toBe(1000);
    // Cubre las dos ventas mas viejas (FIFO), no la de hoy.
    expect(result.coveredSaleIds).toEqual([1, 2]);
  });

  it('rechaza un pago que supera la deuda real (validacion server-side)', () => {
    const salesAsc = [{ id: 1, total_amount: 1000, created_at: '2026-04-28 10:00:00' }];

    expect(() => reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 0,
      paymentAmount: 1500
    })).toThrow(/supera la deuda/i);
  });

  it('descuenta pagos previos antes de decidir que ventas siguen impagas', () => {
    const salesAsc = [
      { id: 1, total_amount: 1000, created_at: '2026-04-28 10:00:00' },
      { id: 2, total_amount: 1000, created_at: '2026-04-29 10:00:00' }
    ];

    const result = reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 1000,
      paymentAmount: 1000
    });

    expect(result.debtTotal).toBe(1000);
    expect(result.isFullyClosing).toBe(true);
    expect(result.coveredSaleIds).toEqual([2]);
  });

  it('un cierre completo cubre TODAS las ventas impagas aunque un pago viejo haya dejado una venta a mitad de cubrir (caso real: Lala Cantera, pago 70)', () => {
    // Reproduce el desajuste encontrado en produccion: un pago historico de
    // $4753 no alcanzo a cubrir una venta de $1540 completa (dejo $488
    // sueltos que el modelo no puede aplicar a una venta parcialmente, ya que
    // no hay forma de "partir" una venta). Esa venta y todas las siguientes
    // quedan impagas, sumando $7469 - mas que la deuda real ($6981). El pago
    // que cierra la cuenta debe cobrar $6981 (correcto) y cubrir las 26
    // ventas completas (el cliente esta cerrando toda su cuenta, no tendria
    // sentido dejar una "venta suelta" marcada impaga con el ticket
    // incompleto).
    const oldSales = [
      { id: 1, total_amount: 4265, created_at: '2026-01-01 10:00:00' }, // se salda entero con los $4753
      { id: 2, total_amount: 1540, created_at: '2026-01-02 10:00:00' }, // $488 no le alcanzan, queda impaga entera
      { id: 3, total_amount: 5929, created_at: '2026-01-03 10:00:00' } // resto de ventas impagas (26 en el caso real, acortado aca)
    ];

    const result = reconcileCustomerAccountPayment({
      salesAsc: oldSales,
      totalPaymentsBefore: 4753,
      paymentAmount: 6981
    });

    expect(result.debtTotal).toBe(6981);
    expect(result.isFullyClosing).toBe(true);
    // Cubre las DOS ventas impagas completas (2 y 3), aunque sumen 7469 y no
    // 6981 - el pago cierra la cuenta entera, no puede dejar una venta
    // "colgada" sin cubrir solo porque el historial viejo no calza perfecto.
    expect(result.coveredSaleIds).toEqual([2, 3]);
  });

  it('un pago parcial (no cierra la cuenta) nunca cubre una venta si eso hace que se pase del monto pagado', () => {
    const salesAsc = [
      { id: 1, total_amount: 300, created_at: '2026-04-28 10:00:00' },
      { id: 2, total_amount: 1000, created_at: '2026-04-29 10:00:00' }
    ];

    const result = reconcileCustomerAccountPayment({
      salesAsc,
      totalPaymentsBefore: 0,
      paymentAmount: 500
    });

    expect(result.isFullyClosing).toBe(false);
    // 500 alcanza para la venta 1 (300) pero no para agregar la venta 2
    // (1000) sin pasarse - se corta antes en vez de marcarla cubierta.
    expect(result.coveredSaleIds).toEqual([1]);
  });
});

describe('selectSalesUpToAmount', () => {
  it('incluye ventas mientras entren completas en el monto disponible', () => {
    const salesAsc = [
      { id: 1, total_amount: 100 },
      { id: 2, total_amount: 200 },
      { id: 3, total_amount: 500 }
    ];

    expect(selectSalesUpToAmount({ salesAsc, targetAmount: 350 }).map((s) => s.id)).toEqual([1, 2]);
  });

  it('con monto 0 no incluye nada', () => {
    const salesAsc = [{ id: 1, total_amount: 100 }];
    expect(selectSalesUpToAmount({ salesAsc, targetAmount: 0 })).toEqual([]);
  });

  it('incluye todas si el monto alcanza justo para la suma total', () => {
    const salesAsc = [
      { id: 1, total_amount: 100 },
      { id: 2, total_amount: 200 }
    ];
    expect(selectSalesUpToAmount({ salesAsc, targetAmount: 300 }).map((s) => s.id)).toEqual([1, 2]);
  });
});

describe('buildCoveredItemsSnapshot', () => {
  it('agrupa items por nombre de producto sumando cantidades y montos', () => {
    const rows = [
      { sale_id: 1, product_name: 'Leche', quantity: 2, line_total: 200 },
      { sale_id: 2, product_name: 'Pan', quantity: 1, line_total: 80 },
      { sale_id: 2, product_name: 'Leche', quantity: 1, line_total: 100 }
    ];

    const items = buildCoveredItemsSnapshot(rows);

    expect(items).toEqual([
      { name: 'Leche', quantity: 3, lineTotal: 300 },
      { name: 'Pan', quantity: 1, lineTotal: 80 }
    ]);
  });

  it('devuelve lista vacia sin filas', () => {
    expect(buildCoveredItemsSnapshot([])).toEqual([]);
  });
});

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

  it('allows customerId on efectivo/tarjeta sales (no solo en cuenta)', () => {
    const result = normalizeSalePayload({
      paymentMethod: 'efectivo',
      customerId: 7,
      items: [{ nombre: 'Yerba', precio_venta: 100, quantity: 1 }]
    });

    expect(result.customer_id).toBe(7);
  });

  it('gana puntos redondeando total/100 cuando hay cliente identificado', () => {
    const roundsUp = normalizeSalePayload({
      paymentMethod: 'efectivo',
      customerId: 7,
      items: [{ nombre: 'Yerba', precio_venta: 1360, quantity: 1 }]
    });
    const roundsDown = normalizeSalePayload({
      paymentMethod: 'efectivo',
      customerId: 7,
      items: [{ nombre: 'Yerba', precio_venta: 1340, quantity: 1 }]
    });

    expect(roundsUp.points_earned).toBe(14);
    expect(roundsDown.points_earned).toBe(13);
  });

  it('no gana puntos en una venta anonima (sin customerId)', () => {
    const result = normalizeSalePayload({
      paymentMethod: 'efectivo',
      items: [{ nombre: 'Yerba', precio_venta: 1000, quantity: 1 }]
    });

    expect(result.customer_id).toBeNull();
    expect(result.points_earned).toBe(0);
  });

  it('calcula puntos ganados sobre el neto, no sobre el total bruto, cuando se usan puntos', () => {
    const result = normalizeSalePayload({
      paymentMethod: 'efectivo',
      customerId: 7,
      pointsToUse: 400,
      items: [{ nombre: 'Yerba', precio_venta: 500, quantity: 1 }]
    });

    expect(result.points_used).toBe(400);
    // Paga 500 - 400 en puntos = 100 en plata -> 1 punto nuevo, no 5.
    expect(result.points_earned).toBe(1);
  });

  it('requires customerId para pagar con puntos', () => {
    expect(() => normalizeSalePayload({
      paymentMethod: 'efectivo',
      pointsToUse: 50,
      items: [{ nombre: 'Yerba', precio_venta: 100, quantity: 1 }]
    })).toThrow('customerId requerido para pagar con puntos');
  });

  it('rejects pointsToUse mayor al total de la venta', () => {
    expect(() => normalizeSalePayload({
      paymentMethod: 'efectivo',
      customerId: 7,
      pointsToUse: 200,
      items: [{ nombre: 'Yerba', precio_venta: 100, quantity: 1 }]
    })).toThrow('No se pueden usar mas puntos que el total de la venta');
  });
});

describe('initial cash preload window helpers', () => {
  it('opens preload window at 22:00 store time', () => {
    expect(isInitialCashPreloadWindowOpen(new Date('2026-06-28T00:59:59.000Z'))).toBe(false);
    expect(isInitialCashPreloadWindowOpen(new Date('2026-06-28T01:00:00.000Z'))).toBe(true);
    expect(INITIAL_CASH_PRELOAD_OPEN_HOUR).toBe(22);
  });

  it('computes current and next store date labels in Montevideo time', () => {
    const date = new Date('2026-06-28T01:15:00.000Z');
    expect(getStoreDateLabelForDate(date)).toBe('2026-06-27');
    expect(getNextStoreDateLabel(date)).toBe('2026-06-28');
  });
});

describe('customer payloads', () => {
  it('normalizes valid customer payloads', async () => {
    const { normalizeCustomerCreatePayload, normalizeCustomerId } = await import('./scanner.model.js');

    expect(normalizeCustomerCreatePayload({
      name: 'Juan Perez',
      phone: '099123123',
      cedula: '1234567-8',
      notes: 'Compra en cuenta'
    })).toEqual({
      name: 'Juan Perez',
      phone: '099123123',
      cedula: '1234567-8',
      notes: 'Compra en cuenta',
      allows_account_sales: false
    });

    expect(normalizeCustomerCreatePayload({
      name: 'Maria Dias',
      cedula: '7654321-0',
      allowsAccountSales: true
    }).allows_account_sales).toBe(true);

    expect(() => normalizeCustomerCreatePayload({
      name: 'Sin Cedula'
    })).toThrow('cedula requerida');

    expect(normalizeCustomerId('7')).toBe(7);
  });

  it('valida el payload de habilitar/deshabilitar cuenta corriente', async () => {
    const { normalizeAllowsAccountSalesPayload } = await import('./scanner.model.js');

    expect(normalizeAllowsAccountSalesPayload({ allowsAccountSales: true })).toEqual({ allows_account_sales: true });
    expect(normalizeAllowsAccountSalesPayload({ allowsAccountSales: false })).toEqual({ allows_account_sales: false });
    expect(() => normalizeAllowsAccountSalesPayload({})).toThrow('allowsAccountSales requerido (boolean)');
  });

  it('valida el payload de editar nombre de cliente', async () => {
    const { normalizeCustomerNamePayload } = await import('./scanner.model.js');

    expect(normalizeCustomerNamePayload({ name: '  Juan Perez  ' })).toEqual({ name: 'Juan Perez' });
    expect(() => normalizeCustomerNamePayload({ name: '' })).toThrow('Ingresa un nombre valido');
    expect(() => normalizeCustomerNamePayload({})).toThrow('Ingresa un nombre valido');
    expect(() => normalizeCustomerNamePayload({ name: 'a'.repeat(121) })).toThrow('El nombre no puede superar 120 caracteres');
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

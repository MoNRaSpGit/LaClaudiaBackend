import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scanner.repository.js', async () => {
  const actual = await vi.importActual('./scanner.repository.js');

  return {
    ...actual,
    closeScannerShift: vi.fn(),
    findScannerShiftById: vi.fn()
  };
});

import {
  closeScannerShift as closeScannerShiftRepo,
  findScannerShiftById
} from './scanner.repository.js';
import { buildShiftSummary, closeScannerShiftForUser } from './scanner.service.js';

describe('buildShiftSummary - cobros de cuenta en efectivo dentro de la caja del turno', () => {
  function openShiftRow(overrides = {}) {
    return {
      id: 501,
      business_date: '2026-04-30',
      shift_type: 'manana',
      status: 'open',
      opened_by_user_id: 1,
      closed_by_user_id: null,
      opened_at: '2026-04-30 10:00:00',
      opening_cash: 1000,
      closed_at: null,
      sales_total: 0,
      sales_count: 0,
      ...overrides
    };
  }

  it('suma un cobro de cuenta en efectivo al monto actual del turno en el que se cobro', () => {
    // Un dia despues de abierto el turno: dentro de la ventana sin importar
    // el offset de zona horaria local del proceso que corre el test.
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [{ payment_method: 'efectivo', amount: 1000, created_at: '2026-05-01 11:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashCustomerAccountPaymentsTotal).toBe(1000);
    // openingCash (1000) + cashSalesTotal (0) + cobros de cuenta en efectivo (1000)
    expect(shift.cashExpectedTotal).toBe(2000);
    expect(shift.cashCurrentTotal).toBe(2000);
  });

  it('no cuenta un cobro de cuenta pagado con tarjeta como efectivo en caja', () => {
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [{ payment_method: 'tarjeta', amount: 500, created_at: '2026-05-01 11:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashCustomerAccountPaymentsTotal).toBe(0);
    expect(shift.cashCurrentTotal).toBe(1000);
  });

  it('ignora un cobro de cuenta que ocurrio fuera de la ventana del turno (antes de abrirlo)', () => {
    // Un dia entero antes: evita falsos positivos/negativos por el offset de
    // zona horaria local del proceso que corre el test.
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [{ payment_method: 'efectivo', amount: 1000, created_at: '2026-04-29 09:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashCustomerAccountPaymentsTotal).toBe(0);
    expect(shift.cashCurrentTotal).toBe(1000);
  });
});

describe('buildShiftSummary - ingresos manuales de caja dentro del turno', () => {
  function openShiftRow(overrides = {}) {
    return {
      id: 501,
      business_date: '2026-04-30',
      shift_type: 'manana',
      status: 'open',
      opened_by_user_id: 1,
      closed_by_user_id: null,
      opened_at: '2026-04-30 10:00:00',
      opening_cash: 1000,
      closed_at: null,
      sales_total: 0,
      sales_count: 0,
      ...overrides
    };
  }

  it('suma un ingreso manual de caja al monto actual del turno en el que se cargo', () => {
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [],
      [{ amount: 200, created_at: '2026-05-01 11:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashDepositsTotal).toBe(200);
    // openingCash (1000) + cashSalesTotal (0) + cobros de cuenta (0) + ingreso (200)
    expect(shift.cashExpectedTotal).toBe(1200);
    expect(shift.cashCurrentTotal).toBe(1200);
  });

  it('ignora un ingreso que ocurrio fuera de la ventana del turno (antes de abrirlo)', () => {
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [],
      [{ amount: 200, created_at: '2026-04-29 09:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashDepositsTotal).toBe(0);
    expect(shift.cashCurrentTotal).toBe(1000);
  });

  it('combina ingreso manual + cobro de cuenta en efectivo en el mismo turno', () => {
    const summary = buildShiftSummary(
      '2026-04-30',
      [openShiftRow()],
      [],
      [],
      [{ payment_method: 'efectivo', amount: 300, created_at: '2026-05-01 10:00:00' }],
      [{ amount: 200, created_at: '2026-05-01 11:00:00' }]
    );

    const shift = summary.shifts.find((item) => item.shiftType === 'manana');
    expect(shift.cashCustomerAccountPaymentsTotal).toBe(300);
    expect(shift.cashDepositsTotal).toBe(200);
    // 1000 + 0 + 300 + 200
    expect(shift.cashExpectedTotal).toBe(1500);
    expect(shift.cashCurrentTotal).toBe(1500);
  });
});

describe('closeScannerShiftForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows any authenticated operario to close an open shift', async () => {
    closeScannerShiftRepo.mockResolvedValue({
      id: 88,
      status: 'closed'
    });

    const result = await closeScannerShiftForUser('88', {
      id: 14,
      role: 'operario'
    });

    expect(findScannerShiftById).not.toHaveBeenCalled();
    expect(closeScannerShiftRepo).toHaveBeenCalledWith(88, 14);
    expect(result).toEqual({
      id: 88,
      status: 'closed'
    });
  });

  it('rejects invalid authenticated users', async () => {
    await expect(closeScannerShiftForUser('88', { role: 'operario' })).rejects.toMatchObject({
      message: 'usuario autenticado invalido',
      statusCode: 401
    });
  });
});

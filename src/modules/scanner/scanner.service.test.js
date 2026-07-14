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
import { closeScannerShiftForUser } from './scanner.service.js';

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

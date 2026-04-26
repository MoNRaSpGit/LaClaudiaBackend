import { getScannerProducts, lookupProductByBarcode } from './scanner.service.js';

export async function scannerLookupController(req, res, next) {
  try {
    const product = await lookupProductByBarcode(req.query.barcode);
    res.json({
      ok: true,
      item: product
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerListController(req, res, next) {
  try {
    const data = await getScannerProducts(req.query.limit);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

import { findProductByBarcode, listProducts } from './scanner.repository.js';
import { normalizeBarcode, normalizeLimit } from './scanner.model.js';

export async function lookupProductByBarcode(rawBarcode) {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) {
    const error = new Error('Barcode requerido');
    error.statusCode = 400;
    throw error;
  }

  const product = await findProductByBarcode(barcode);
  if (!product) {
    const error = new Error('Producto no encontrado para ese codigo de barras');
    error.statusCode = 404;
    throw error;
  }

  return product;
}

export async function getScannerProducts(rawLimit) {
  const limit = normalizeLimit(rawLimit);
  const items = await listProducts({ limit });
  return {
    count: items.length,
    items
  };
}

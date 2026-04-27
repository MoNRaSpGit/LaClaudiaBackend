import { getScannerDashboard } from './scanner.service.js';

const dashboardSubscribers = new Map();
let keepAliveTimer = null;
let nextSubscriberId = 1;
let latestLiveScannerState = {
  operator: null,
  items: [],
  lastScannedAt: null,
  liveEditor: null,
  updatedAt: null
};

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function removeSubscriber(id) {
  dashboardSubscribers.delete(id);
  if (!dashboardSubscribers.size && keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function ensureKeepAlive() {
  if (keepAliveTimer) {
    return;
  }

  keepAliveTimer = setInterval(() => {
    for (const [id, subscriber] of dashboardSubscribers.entries()) {
      try {
        subscriber.res.write(': keepalive\n\n');
      } catch (_error) {
        removeSubscriber(id);
      }
    }
  }, 25000);
}

export function addDashboardSubscriber({ res, query }) {
  const id = nextSubscriberId++;
  dashboardSubscribers.set(id, { id, res, query: query || {} });
  ensureKeepAlive();

  return () => removeSubscriber(id);
}

export async function pushDashboardSnapshot(subscriber) {
  const dashboard = await getScannerDashboard(subscriber.query || {});
  writeSseEvent(subscriber.res, 'dashboard', {
    ok: true,
    dashboard
  });
}

export function getLiveScannerState() {
  return latestLiveScannerState;
}

export async function pushLiveScannerSnapshot(subscriber) {
  writeSseEvent(subscriber.res, 'live_scanner', {
    ok: true,
    liveScanner: latestLiveScannerState
  });
}

export async function notifyDashboardChanged() {
  const subscribers = Array.from(dashboardSubscribers.values());
  await Promise.allSettled(
    subscribers.map(async (subscriber) => {
      try {
        await pushDashboardSnapshot(subscriber);
      } catch (error) {
        try {
          writeSseEvent(subscriber.res, 'error', {
            ok: false,
            message: error?.message || 'No se pudo refrescar dashboard'
          });
        } catch (_writeError) {
          removeSubscriber(subscriber.id);
        }
      }
    })
  );
}

function sanitizeLiveScannerPayload(payload = {}, user = {}) {
  const sourceItems = Array.isArray(payload.items) ? payload.items : [];
  const items = sourceItems.map((item, index) => ({
    id: item?.id != null ? String(item.id) : `line-${index}`,
    nombre: String(item?.nombre || '').trim() || 'Producto sin nombre',
    quantity: Math.max(1, Number(item?.quantity || 1)),
    precio_venta: Number(item?.precio_venta || 0)
  }));

  const rawLiveEditor = payload?.liveEditor;
  let liveEditor = null;
  if (rawLiveEditor && typeof rawLiveEditor === 'object') {
    liveEditor = {
      type: String(rawLiveEditor.type || 'edit'),
      title: String(rawLiveEditor.title || 'Editando producto'),
      description: String(rawLiveEditor.description || ''),
      draft: rawLiveEditor.draft && typeof rawLiveEditor.draft === 'object'
        ? {
            ...rawLiveEditor.draft,
            nombre: String(rawLiveEditor.draft.nombre || '').trim(),
            precio_venta: Number(rawLiveEditor.draft.precio_venta || 0),
            precio_venta_raw: rawLiveEditor.draft.precio_venta_raw != null
              ? String(rawLiveEditor.draft.precio_venta_raw)
              : undefined
          }
        : null
    };
  }

  return {
    operator: {
      id: Number(user.id || 0) || null,
      username: String(user.username || '').trim() || null,
      display_name: String(user.display_name || user.username || '').trim() || 'Operario',
      role: String(user.role || '').trim().toLowerCase() || null
    },
    items,
    lastScannedAt: payload?.lastScannedAt ? String(payload.lastScannedAt) : null,
    liveEditor,
    updatedAt: new Date().toISOString()
  };
}

export async function setLiveScannerState(rawPayload, user) {
  latestLiveScannerState = sanitizeLiveScannerPayload(rawPayload, user);
}

export async function notifyLiveScannerChanged() {
  const subscribers = Array.from(dashboardSubscribers.values());
  await Promise.allSettled(
    subscribers.map(async (subscriber) => {
      try {
        await pushLiveScannerSnapshot(subscriber);
      } catch (_error) {
        removeSubscriber(subscriber.id);
      }
    })
  );
}

export function getS2PingSnapshot() {
  return {
    ok: true,
    project: 's2ping',
    message: 'Hola desde el backend compartido (SaasTwo)',
    timestamp: new Date().toISOString()
  };
}

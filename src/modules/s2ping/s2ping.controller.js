import { getS2PingSnapshot } from './s2ping.service.js';

export function s2pingController(_req, res) {
  res.json(getS2PingSnapshot());
}

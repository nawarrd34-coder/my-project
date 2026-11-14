import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export type UrlSafetyCode =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'credentials_not_allowed'
  | 'port_not_allowed'
  | 'ip_literal_not_allowed'
  | 'hostname_not_public'
  | 'private_address'
  | 'dns_failed';

export class UrlSafetyError extends Error {
  constructor(
    public readonly code: UrlSafetyCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'UrlSafetyError';
  }
}

/**
 * Local-development escape hatch so the scanner can be pointed at a site on
 * localhost. It is ignored in production builds no matter what the env says.
 */
export function privateHostsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUDIT_ALLOW_PRIVATE_HOSTS === '1';
}

// Names that never resolve on the public internet, or are reserved (RFC 2606 / 6761 / 8375).
const BLOCKED_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'arpa',
  'test',
  'invalid',
  'example',
  'onion',
];

const MAX_URL_LENGTH = 2048;

/** Parse user input into a URL, defaulting to https:// when no scheme was typed. */
export function parseUserUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /[\s<>"'`\\^{}|]/.test(trimmed)) {
    throw new UrlSafetyError('invalid_url');
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    // "host:port" also matches the scheme pattern; let URL parsing decide below.
    if (!/^[^/]+:\d+(\/|$)/.test(trimmed)) throw new UrlSafetyError('unsupported_protocol');
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UrlSafetyError('invalid_url');
  }
  url.hash = '';
  return url;
}

/** Static checks that need no network access. Throws UrlSafetyError. */
export function assertSafeUrl(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlSafetyError('unsupported_protocol');
  }
  if (url.username || url.password) throw new UrlSafetyError('credentials_not_allowed');

  const allowPrivate = privateHostsAllowed();
  if (url.port && !allowPrivate) throw new UrlSafetyError('port_not_allowed');

  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  if (!host) throw new UrlSafetyError('invalid_url');

  // WHATWG URL parsing has already normalised decimal/hex/octal IPv4 forms
  // (e.g. http://2130706433/) into dotted notation, so one check covers them.
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  if (ipaddr.isValid(bare)) {
    if (allowPrivate) return;
    throw new UrlSafetyError('ip_literal_not_allowed');
  }
  if (allowPrivate) return;

  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  if (labels.length < 2 || labels.some((l) => !l || l.length > 63) || host.length > 253) {
    throw new UrlSafetyError('hostname_not_public');
  }
  if (!/^([a-z]{2,}|xn--[a-z0-9-]+)$/.test(tld) || BLOCKED_SUFFIXES.includes(tld)) {
    throw new UrlSafetyError('hostname_not_public');
  }
}

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  // Anything ipaddr.js classifies (private, loopback, linkLocal, carrierGradeNat,
  // uniqueLocal, multicast, reserved, 6to4, teredo, NAT64, …) is rejected.
  return parsed.range() === 'unicast';
}

export interface PinnedAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Resolve a hostname and return one address to connect to. Every address the
 * name resolves to must be public: a name that mixes public and private
 * records is rejected outright. The caller connects to the returned IP
 * directly, so a second DNS answer (rebinding) can never be used.
 */
export async function resolvePublicHost(hostname: string): Promise<PinnedAddress> {
  const host = hostname.replace(/^\[|\]$/g, '');
  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UrlSafetyError('dns_failed', host);
  }
  if (!records.length) throw new UrlSafetyError('dns_failed', host);
  if (!privateHostsAllowed() && records.some((r) => !isPublicAddress(r.address))) {
    throw new UrlSafetyError('private_address', host);
  }
  const chosen = records.find((r) => r.family === 4) ?? records[0];
  return { address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

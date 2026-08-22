/**
 * Single definition of "this address cannot leave the local network".
 *
 * Auth configuration and the API client both relax the HTTPS requirement for
 * local development, and a physical device reaches the development machine by
 * its LAN address rather than by `localhost`. Keeping one implementation means
 * the two cannot drift apart and disagree about what is reachable — which is
 * exactly how the app came to pass configuration validation and then crash
 * inside the API client.
 *
 * The rule is range-based on purpose: a public hostname over plaintext still
 * fails closed, so a misconfigured build cannot ship cleartext auth traffic.
 */
export function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  // Bonjour/mDNS names resolve only on the local link.
  if (host.endsWith(".local")) return true;
  if (host === "::1" || host === "[::1]") return true;
  return isPrivateIpv4(host);
}

/** True when the URL is HTTPS, or plaintext to a host that stays on this LAN. */
export function isEncryptedOrLocalUrl(url: URL): boolean {
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return isPrivateNetworkHost(url.hostname);
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split(".");
  if (octets.length !== 4) return false;
  const parsed = octets.map((octet) =>
    /^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN,
  );
  if (parsed.some((octet) => Number.isNaN(octet) || octet > 255)) return false;
  const [first, second] = parsed;
  if (first === 127) return true; // loopback
  if (first === 10) return true; // RFC1918 /8
  if (first === 172 && second >= 16 && second <= 31) return true; // RFC1918 /12
  if (first === 192 && second === 168) return true; // RFC1918 /16
  if (first === 169 && second === 254) return true; // link-local
  return false;
}

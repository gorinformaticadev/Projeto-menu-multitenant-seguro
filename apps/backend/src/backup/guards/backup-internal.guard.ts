import { timingSafeEqual } from 'crypto';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'net';

const DEFAULT_ALLOWED_CIDRS = '127.0.0.1/32,::1/128';

type IpVersion = 4 | 6;

interface ParsedIp {
  version: IpVersion;
  value: bigint;
}

interface ParsedCidr {
  version: IpVersion;
  network: bigint;
  prefix: number;
  maxPrefix: number;
}

@Injectable()
export class BackupInternalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const configuredToken = (this.configService.get<string>('BACKUP_INTERNAL_API_TOKEN') || '').trim();
    if (!configuredToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const providedToken = this.readSingleHeader(request.headers?.['x-backup-internal-token']);
    if (!providedToken || !this.safeTokenEquals(providedToken, configuredToken)) {
      throw new UnauthorizedException('Unauthorized');
    }

    const allowedCidrs = this.readCidrList('BACKUP_INTERNAL_ALLOWED_CIDRS', DEFAULT_ALLOWED_CIDRS);
    if (allowedCidrs.length === 0) {
      throw new ForbiddenException('Forbidden');
    }

    const remoteIp = this.parseIpAddress(
      this.readSocketAddress(request.socket?.remoteAddress, request.connection?.remoteAddress),
    );
    if (!remoteIp) {
      throw new ForbiddenException('Forbidden');
    }

    const resolvedSourceIp = this.resolveSourceIp(request, remoteIp);
    if (!this.isIpAllowed(resolvedSourceIp, allowedCidrs)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }

  private resolveSourceIp(request: any, remoteIp: ParsedIp): ParsedIp {
    if (!this.readBoolean('BACKUP_INTERNAL_TRUST_PROXY', false)) {
      return remoteIp;
    }

    const trustedProxyCidrs = this.readCidrList('BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS');
    if (trustedProxyCidrs.length === 0 || !this.isIpAllowed(remoteIp, trustedProxyCidrs)) {
      return remoteIp;
    }

    const forwardedFor = this.readHeader(request.headers?.['x-forwarded-for']);
    if (!forwardedFor) {
      return remoteIp;
    }

    const forwardedHops = forwardedFor
      .split(',')
      .map((hop) => this.parseIpAddress(hop))
      .filter((hop): hop is ParsedIp => Boolean(hop));

    if (forwardedHops.length === 0) {
      return remoteIp;
    }

    // Use the last forwarded hop to avoid trusting an arbitrary first value.
    return forwardedHops[forwardedHops.length - 1];
  }

  private readSocketAddress(socketAddress?: string, connectionAddress?: string): string {
    return String(socketAddress || connectionAddress || '').trim();
  }

  private readHeader(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry).trim()).join(',').trim();
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  }

  private readSingleHeader(value: unknown): string {
    if (Array.isArray(value)) {
      return String(value[0] || '').trim();
    }
    return typeof value === 'string' ? value.trim() : '';
  }

  private readBoolean(envName: string, fallback: boolean): boolean {
    const raw = (this.configService.get<string>(envName) || '').trim().toLowerCase();
    if (!raw) {
      return fallback;
    }
    if (['1', 'true', 'yes', 'on'].includes(raw)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(raw)) {
      return false;
    }
    return fallback;
  }

  private readCidrList(envName: string, fallback?: string): ParsedCidr[] {
    const configured = this.configService.get<string>(envName);
    const source = configured === undefined || configured === null ? fallback || '' : configured;
    if (!source || !source.trim()) {
      return [];
    }

    return source
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => this.parseCidr(token))
      .filter((cidr): cidr is ParsedCidr => Boolean(cidr));
  }

  private parseCidr(value: string): ParsedCidr | null {
    const [ipPartRaw, prefixPartRaw] = value.split('/');
    if (!ipPartRaw) {
      return null;
    }

    const parsedIp = this.parseIpAddress(ipPartRaw);
    if (!parsedIp) {
      return null;
    }

    const maxPrefix = parsedIp.version === 4 ? 32 : 128;
    const prefix =
      prefixPartRaw === undefined || prefixPartRaw.trim() === ''
        ? maxPrefix
        : Number(prefixPartRaw.trim());

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
      return null;
    }

    return {
      version: parsedIp.version,
      network: this.applyPrefix(parsedIp.value, maxPrefix, prefix),
      prefix,
      maxPrefix,
    };
  }

  private parseIpAddress(raw: string): ParsedIp | null {
    const normalized = this.normalizeIp(raw);
    if (!normalized) {
      return null;
    }

    const version = isIP(normalized);
    if (version !== 4 && version !== 6) {
      return null;
    }

    return {
      version,
      value: version === 4 ? this.ipv4ToBigInt(normalized) : this.ipv6ToBigInt(normalized),
    };
  }

  private normalizeIp(raw: string): string | null {
    if (!raw || !raw.trim()) {
      return null;
    }

    let candidate = raw.trim().toLowerCase();

    if (candidate.startsWith('[') && candidate.includes(']')) {
      candidate = candidate.slice(1, candidate.indexOf(']'));
    }

    candidate = candidate.replace(/%.+$/, '');

    const ipv4WithPortMatch = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPortMatch) {
      candidate = ipv4WithPortMatch[1];
    }

    if (candidate.startsWith('::ffff:')) {
      const mappedIpv4 = candidate.slice(7);
      if (isIP(mappedIpv4) === 4) {
        return mappedIpv4;
      }
    }

    return candidate;
  }

  private ipv4ToBigInt(ip: string): bigint {
    return ip
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, octet) => (acc << 8n) + BigInt(octet), 0n);
  }

  private ipv6ToBigInt(ip: string): bigint {
    const normalized = ip.toLowerCase();
    const [leftPart, rightPart = ''] = normalized.split('::');
    const leftGroups = this.parseIpv6Groups(leftPart);
    const rightGroups = this.parseIpv6Groups(rightPart);

    const missing = 8 - (leftGroups.length + rightGroups.length);
    const expanded =
      normalized.includes('::') && missing >= 0
        ? [...leftGroups, ...new Array(missing).fill(0), ...rightGroups]
        : [...leftGroups, ...rightGroups];

    if (expanded.length !== 8) {
      throw new ForbiddenException('Forbidden');
    }

    return expanded.reduce((acc, group) => (acc << 16n) + BigInt(group), 0n);
  }

  private parseIpv6Groups(part: string): number[] {
    if (!part) {
      return [];
    }

    return part
      .split(':')
      .filter((group) => group.length > 0)
      .flatMap((group) => {
        if (group.includes('.')) {
          const ipv4 = this.ipv4ToBigInt(group);
          const high = Number((ipv4 >> 16n) & 0xffffn);
          const low = Number(ipv4 & 0xffffn);
          return [high, low];
        }
        const parsed = Number.parseInt(group, 16);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0xffff) {
          throw new ForbiddenException('Forbidden');
        }
        return [parsed];
      });
  }

  private applyPrefix(value: bigint, maxPrefix: number, prefix: number): bigint {
    if (prefix <= 0) {
      return 0n;
    }
    if (prefix >= maxPrefix) {
      return value;
    }

    const shift = BigInt(maxPrefix - prefix);
    return (value >> shift) << shift;
  }

  private isIpAllowed(ip: ParsedIp, cidrs: ParsedCidr[]): boolean {
    for (const cidr of cidrs) {
      if (cidr.version !== ip.version) {
        continue;
      }

      if (cidr.prefix === 0) {
        return true;
      }

      const shift = BigInt(cidr.maxPrefix - cidr.prefix);
      if ((ip.value >> shift) === (cidr.network >> shift)) {
        return true;
      }
    }

    return false;
  }

  private safeTokenEquals(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}

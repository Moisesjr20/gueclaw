import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import axios from 'axios';
import { URL } from 'url';
import * as net from 'net';
import * as dns from 'dns/promises';

// RFC1918, link-local, loopback and CGNAT ranges — blocked to prevent SSRF
const SSRF_BLOCKED: RegExp[] = [
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^100\.64\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isBlockedIp(ip: string): boolean {
  return SSRF_BLOCKED.some(r => r.test(ip));
}

async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`URL inválida: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocolo não permitido: ${parsed.protocol}. Use http ou https.`);
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Hostname interno bloqueado: ${hostname}`);
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error(`Acesso a endereço IP interno bloqueado: ${hostname}`);
    }
    return;
  }

  // Resolve DNS and re-validate the resulting IPs
  const addresses = await (dns.resolve4(hostname).catch(() => [] as string[]));
  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new Error(`DNS de '${hostname}' resolve para endereço interno: ${addr}`);
    }
  }
}

function maskSensitiveUrl(url: string): string {
  return url
    .replace(/\/bot\d+:[A-Za-z0-9_-]+\//g, '/bot[REDACTED]/')
    .replace(/([?&](?:token|key|secret|password|api_key)=)[^&]*/gi, '$1[REDACTED]');
}

/**
 * Tool for making HTTP API requests
 */
export class APIRequestTool extends BaseTool {
  public readonly name = 'api_request';
  public readonly description = 'Make HTTP API requests (GET, POST, PUT, DELETE, PATCH) to external services.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: 'HTTP method',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          },
          url: {
            type: 'string',
            description: 'Full URL to make the request to',
          },
          headers: {
            type: 'object',
            description: 'HTTP headers as key-value pairs (optional)',
          },
          body: {
            type: 'object',
            description: 'Request body for POST/PUT/PATCH (optional, will be JSON encoded)',
          },
          queryParams: {
            type: 'object',
            description: 'URL query parameters as key-value pairs (optional)',
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in milliseconds (optional, defaults to 30000)',
          },
        },
        required: ['method', 'url'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['method', 'url']);

      const { method, url, headers = {}, body, queryParams, timeout = 30000 } = args;

      await assertSafeUrl(url);
      console.log(`🌐 Making ${method} request to ${maskSensitiveUrl(url)}`);
      const config: any = {
        method: method.toUpperCase(),
        url,
        headers: {
          'User-Agent': 'GueClaw-Agent/2.0',
          ...headers,
        },
        timeout,
      };

      // Add query parameters
      if (queryParams) {
        config.params = queryParams;
      }

      // Add body for POST/PUT/PATCH
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        config.data = body;
        
        // Set Content-Type if not already set
        if (!config.headers['Content-Type']) {
          config.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await axios(config);

      // Format response
      const output = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      };

      return this.success(JSON.stringify(output, null, 2), {
        status: response.status,
        contentType: response.headers['content-type'],
      });

    } catch (error: any) {
      const err = error as any;
      console.error(`❌ API request error:`, err.message);

      if (err.response) {
        // Server responded with error status
        const errorOutput = {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
        };

        return this.error(
          `API request failed with status ${err.response.status}: ${JSON.stringify(errorOutput, null, 2)}`
        );
      }

      return this.error(`API request failed: ${err.message}`);
    }
  }
}

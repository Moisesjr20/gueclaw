import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import axios from 'axios';

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

      console.log(`🌐 Making ${method} request to ${url}`);

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

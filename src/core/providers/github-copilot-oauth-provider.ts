import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse } from '../../types';
import { TelegramNotifier } from '../../services/telegram-notifier';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GitHub Copilot OAuth Provider - Uses Device Code Flow
 * 
 * Authentication Flow:
 * 1. Request device code
 * 2. User visits URL and enters 8-digit code
 * 3. Poll for access token
 * 4. Use token for API requests
 * 
 * Auto-Renewal:
 * - Detects token expiration (401 errors)
 * - Sends OAuth request via Telegram
 * - Automatically renews and resumes
 */
export class GitHubCopilotOAuthProvider implements ILLMProvider {
  public readonly name = 'github-copilot-oauth';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;

  private client: AxiosInstance;
  private model: string;
  private accessToken: string | null = null;
  private tokenPath: string;
  private clientId = 'Iv1.b507a08c87ecfe98'; // GitHub Copilot Client ID
  private notifier: TelegramNotifier | null = null;
  private isRenewing: boolean = false;

  constructor(
    model: string = 'claude-sonnet-4.5',
    tokenPath: string = './data/github-token.json',
    notifier?: TelegramNotifier
  ) {
    this.model = model;
    this.tokenPath = tokenPath;
    this.notifier = notifier || null;

    this.client = axios.create({
      timeout: 180000,
    });

    // Try to load existing token
    this.loadToken();
  }

  /**
   * Authenticate using Device Code Flow
   */
  public async authenticate(): Promise<{ userCode: string; verificationUri: string }> {
    try {
      // Step 1: Request device code
      const deviceResponse = await axios.post(
        'https://github.com/login/device/code',
        {
          client_id: this.clientId,
          scope: 'read:user user:email',
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const {
        device_code,
        user_code,
        verification_uri,
        expires_in,
        interval,
      } = deviceResponse.data;

      console.log('\n╔══════════════════════════════════════════════════╗');
      console.log('║     🔐 GitHub Copilot Authentication            ║');
      console.log('╚══════════════════════════════════════════════════╝\n');
      console.log(`📱 Acesse: ${verification_uri}`);
      console.log(`🔑 Digite o código: ${user_code}\n`);
      console.log('⏳ Aguardando autenticação...\n');

      // Step 2: Poll for access token
      const pollInterval = (interval || 5) * 1000;
      const expiresAt = Date.now() + expires_in * 1000;

      while (Date.now() < expiresAt) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        try {
          const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
              client_id: this.clientId,
              device_code: device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            },
            {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );

          const { access_token, error } = tokenResponse.data;

          if (access_token) {
            this.accessToken = access_token;
            this.saveToken(access_token);

            console.log('✅ Autenticação bem-sucedida!\n');
            console.log('🔑 Token salvo em:', this.tokenPath, '\n');

            // Get Copilot token
            await this.getCopilotToken();

            return { userCode: user_code, verificationUri: verification_uri };
          }

          if (error === 'authorization_pending') {
            // Continue polling
            continue;
          }

          if (error === 'slow_down') {
            // Increase interval
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          if (error === 'expired_token' || error === 'access_denied') {
            throw new Error(`Authentication failed: ${error}`);
          }

        } catch (pollError: any) {
          if (pollError.response?.data?.error === 'authorization_pending') {
            continue;
          }
          throw pollError;
        }
      }

      throw new Error('Authentication timeout - código expirou');

    } catch (error: any) {
      console.error('❌ Erro na autenticação:', error.message);
      throw error;
    }
  }

  /**
   * Get GitHub Copilot API token
   */
  private async getCopilotToken(): Promise<void> {
    try {
      const response = await axios.get(
        'https://api.github.com/copilot_internal/v2/token',
        {
          headers: {
            'Authorization': `token ${this.accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      const copilotToken = response.data.token;
      
      // Update client with Copilot token
      this.client = axios.create({
        baseURL: 'https://api.githubcopilot.com',
        headers: {
          'Authorization': `Bearer ${copilotToken}`,
          'Content-Type': 'application/json',
          'Editor-Version': 'vscode/1.85.0',
          'Editor-Plugin-Version': 'copilot/1.150.0',
          'User-Agent': 'GithubCopilot/1.150.0',
        },
        timeout: 180000,
      });

      console.log('✅ Token do Copilot obtido com sucesso!\n');

    } catch (error: any) {
      console.error('❌ Erro ao obter token do Copilot:', error.message);
      throw error;
    }
  }

  /**
   * Load saved token from file
   */
  private loadToken(): void {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const data = fs.readFileSync(this.tokenPath, 'utf-8');
        const tokenData = JSON.parse(data);
        this.accessToken = tokenData.access_token;
        
        // Get fresh Copilot token
        this.getCopilotToken().catch(() => {
          console.warn('⚠️  Token expirado. Execute: npm run copilot:auth');
        });
      }
    } catch (error) {
      // Token file doesn't exist or is invalid
      this.accessToken = null;
    }
  }

  /**
   * Save token to file
   */
  private saveToken(token: string): void {
    try {
      const dir = path.dirname(this.tokenPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.tokenPath,
        JSON.stringify({ access_token: token, created_at: Date.now() }, null, 2)
      );
    } catch (error: any) {
      console.error('⚠️  Não foi possível salvar o token:', error.message);
    }
  }

  /**
   * Automatically renew token and send notification via Telegram
   */
  private async autoRenewToken(): Promise<void> {
    // Prevent multiple simultaneous renewals
    if (this.isRenewing) {
      console.log('⏳ Token renewal already in progress...');
      return;
    }

    this.isRenewing = true;

    try {
      console.log('🔄 Auto-renewing GitHub Copilot token...');

      // Step 1: Request device code
      const deviceResponse = await axios.post(
        'https://github.com/login/device/code',
        {
          client_id: this.clientId,
          scope: 'read:user user:email',
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const {
        device_code,
        user_code,
        verification_uri,
        expires_in,
        interval,
      } = deviceResponse.data;

      // Send notification via Telegram
      if (this.notifier) {
        await this.notifier.sendOAuthRequest(device_code, user_code, verification_uri);
      } else {
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║     🔐 Token Expirado - Renovação Necessária    ║');
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log(`📱 Acesse: ${verification_uri}`);
        console.log(`🔑 Digite o código: ${user_code}\n`);
      }

      // Step 2: Poll for access token
      const pollInterval = (interval || 5) * 1000;
      const expiresAt = Date.now() + expires_in * 1000;

      while (Date.now() < expiresAt) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        try {
          const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
              client_id: this.clientId,
              device_code: device_code,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            },
            {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );

          const { access_token, error } = tokenResponse.data;

          if (access_token) {
            this.accessToken = access_token;
            this.saveToken(access_token);

            console.log('✅ Token renovado com sucesso!');

            // Get fresh Copilot token
            await this.getCopilotToken();

            // Send success notification
            if (this.notifier) {
              await this.notifier.sendOAuthSuccess();
            }

            this.isRenewing = false;
            return;
          }

          if (error === 'authorization_pending') {
            continue;
          }

          if (error === 'slow_down') {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          if (error === 'expired_token' || error === 'access_denied') {
            throw new Error(`Renovation failed: ${error}`);
          }

        } catch (pollError: any) {
          if (pollError.response?.data?.error === 'authorization_pending') {
            continue;
          }
          throw pollError;
        }
      }

      throw new Error('Token renovation timeout');

    } catch (error: any) {
      console.error('❌ Failed to auto-renew token:', error.message);
      
      if (this.notifier) {
        await this.notifier.sendOAuthFailure(error.message);
      }
      
      this.isRenewing = false;
      throw error;
    }
  }

  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  public async generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse> {
    if (!this.isAuthenticated()) {
      return {
        content: 'Erro: GitHub Copilot não autenticado. Execute: npm run copilot:auth',
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    try {
      // Format messages
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      // Build request payload
      const payload: any = {
        messages: formattedMessages,
        model: this.model,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: false,
      };

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        payload.tools = options.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
      }

      // Call Copilot API
      const response = await this.client.post('/chat/completions', payload);

      // Parse response
      return this.parseResponse(response.data);

    } catch (error: any) {
      console.error('❌ GitHub Copilot API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        console.log('🔄 Token expired - attempting auto-renewal...');
        
        // Try to auto-renew token
        try {
          await this.autoRenewToken();
          
          // Retry the request with new token
          return await this.generateCompletion(messages, options);
        } catch (renewError: any) {
          return {
            content: 'Erro: Token expirado e renovação falhou. Verifique o Telegram para instruções de autenticação.',
            finishReason: 'error',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
        }
      }

      return {
        content: `Erro do GitHub Copilot: ${error.response?.data?.message || error.message}`,
        finishReason: 'error',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }

  private formatMessages(messages: Message[], systemPrompt?: string): any[] {
    const formatted: any[] = [];

    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    for (const msg of messages) {
      const formattedMsg: any = {
        role: msg.role === 'tool' ? 'assistant' : msg.role,
        content: msg.content,
      };

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formattedMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        }));
      }

      formatted.push(formattedMsg);
    }

    return formatted;
  }

  private parseResponse(data: any): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;

    const response: LLMResponse = {
      content: message.content || '',
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };

    if (message.tool_calls && message.tool_calls.length > 0) {
      response.toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        },
      }));
    }

    return response;
  }
}

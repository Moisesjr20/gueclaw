import { Message } from '../types';

/**
 * Document Security Analyzer
 * Detecta PII (Personally Identifiable Information) e classifica documentos
 */

export interface PIIDetection {
  type: PIICategory;
  value: string;
  confidence: number;
  position: { start: number; end: number };
}

export type PIICategory =
  | 'cpf'
  | 'cnpj'
  | 'rg'
  | 'cnh'
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'bank_account'
  | 'password'
  | 'api_key'
  | 'address'
  | 'birth_date'
  | 'ip_address';

export interface SecurityClassification {
  level: 'public' | 'internal' | 'confidential' | 'secret';
  reasons: string[];
  piiCount: number;
  sensitiveTopics: string[];
}

export interface AnalysisResult {
  text: string;
  piiDetections: PIIDetection[];
  classification: SecurityClassification;
  alerts: SecurityAlert[];
  metadata: {
    analyzedAt: string;
    textLength: number;
    language: string;
  };
}

export interface SecurityAlert {
  type: 'pii_detected' | 'classification_changed' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
}

export class DocumentSecurityAnalyzer {
  // Regex patterns para detecção de PII
  private patterns: Record<PIICategory, RegExp> = {
    cpf: /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})|(\d{11})$/,
    cnpj: /^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})|(\d{14})$/,
    rg: /^[\d]{2,3}\.?\d{3,4}\.?\d{3,4}[-]?[\dX]{1,2}$/,
    cnh: /^\d{11}$/,
    email: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /^(\+?55)?\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/,
    credit_card: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
    bank_account: /^\d{3,4}-\d{1,2}|\d{4,5}-\d{1}$/,
    password: /(?:password|senha|pass|pwd)[:\s]+[^\s]{6,}/i,
    api_key: /(?:api[_-]?key|apikey|api_secret|token)[:\s=]+['"]?[a-zA-Z0-9_-]{20,}['"]?/i,
    address: /(?:rua|avenida|av\.|av|street|st\.|road|rd\.|number|número|cep)\s+[^\n,]{5,}/i,
    birth_date: /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b|\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/,
    ip_address: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  };

  constructor() {}

  /**
   * Analyze document text for PII and classify security level
   */
  public async analyze(text: string): Promise<AnalysisResult> {
    const piiDetections = this.detectPII(text);
    const sensitiveTopics = await this.detectSensitiveTopics(text);
    const classification = this.classifyDocument(piiDetections, sensitiveTopics, text);
    const alerts = this.generateAlerts(piiDetections, classification);

    return {
      text,
      piiDetections,
      classification,
      alerts,
      metadata: {
        analyzedAt: new Date().toISOString(),
        textLength: text.length,
        language: this.detectLanguage(text),
      },
    };
  }

  /**
   * Detect PII in text using regex patterns
   */
  public detectPII(text: string): PIIDetection[] {
    const detections: PIIDetection[] = [];

    for (const [category, pattern] of Object.entries(this.patterns)) {
      const matches = text.matchAll(new RegExp(pattern, 'g'));

      for (const match of matches) {
        const value = match[0];
        const start = match.index || 0;

        // Validate specific formats
        if (!this.validatePII(category as PIICategory, value)) {
          continue;
        }

        detections.push({
          type: category as PIICategory,
          value: this.maskPII(value, category as PIICategory),
          confidence: this.calculateConfidence(category as PIICategory, value),
          position: {
            start,
            end: start + value.length,
          },
        });
      }
    }

    return detections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect sensitive topics using AI (Ollama Cloud)
   */
  public async detectSensitiveTopics(text: string): Promise<string[]> {
    return this.detectSensitiveTopicsSimple(text);
  }

  /**
   * Simple topic detection without AI
   */
  private detectSensitiveTopicsSimple(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      financial: ['banco', 'conta', 'saldo', 'transferência', 'pix', 'boleto', 'fatura', 'cartão', 'crédito', 'débito'],
      legal: ['contrato', 'processo', 'advogado', 'tribunal', 'lei', 'jurídico', 'ação judicial'],
      medical: ['saúde', 'médico', 'hospital', 'receita', 'exame', 'diagnóstico', 'tratamento', 'paciente'],
      personal: ['pessoal', 'privado', 'confidencial', 'íntimo'],
      credentials: ['senha', 'login', 'usuário', 'username', 'password', 'token', 'api key'],
      business: ['estratégia', 'receita', 'lucro', 'margem', 'cliente', 'fornecedor', 'parceria'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Classify document security level
   */
  private classifyDocument(
    piiDetections: PIIDetection[],
    sensitiveTopics: string[],
    text: string
  ): SecurityClassification {
    const reasons: string[] = [];
    let level: SecurityClassification['level'] = 'public';

    // Check for high-risk PII
    const highRiskPII = ['cpf', 'cnpj', 'rg', 'cnh', 'credit_card', 'bank_account', 'password', 'api_key'];
    const foundHighRiskPII = piiDetections.filter(d => highRiskPII.includes(d.type));

    if (foundHighRiskPII.length > 0) {
      level = 'confidential';
      reasons.push(`Contains high-risk PII: ${foundHighRiskPII.map(p => p.type).join(', ')}`);
    }

    // Check for credentials
    if (sensitiveTopics.includes('credentials')) {
      level = 'secret';
      reasons.push('Contains credentials or authentication information');
    }

    // Check for sensitive topics
    if (sensitiveTopics.includes('financial') || sensitiveTopics.includes('medical')) {
      if (level === 'public') level = 'internal';
      if (level === 'internal' && piiDetections.length > 0) level = 'confidential';
      reasons.push(`Contains sensitive ${sensitiveTopics.filter(t => ['financial', 'medical'].includes(t)).join(' and ')} information`);
    }

    // Check for legal content
    if (sensitiveTopics.includes('legal')) {
      if (level === 'public' || level === 'internal') level = 'confidential';
      reasons.push('Contains legal content');
    }

    // Check text patterns for classification markers
    const lowerText = text.toLowerCase();
    if (lowerText.includes('altamente confidencial') || lowerText.includes('top secret')) {
      level = 'secret';
      reasons.push('Document marked as highly confidential');
    } else if (lowerText.includes('confidencial') || lowerText.includes('uso interno')) {
      if (level !== 'secret') level = 'confidential';
      reasons.push('Document marked as confidential');
    } else if (lowerText.includes('uso interno') || lowerText.includes('internal use')) {
      if (level === 'public') level = 'internal';
      reasons.push('Document marked for internal use');
    }

    // Default to public if no concerns
    if (level === 'public' && piiDetections.length === 0 && sensitiveTopics.length === 0) {
      reasons.push('No sensitive content detected');
    }

    return {
      level,
      reasons,
      piiCount: piiDetections.length,
      sensitiveTopics,
    };
  }

  /**
   * Generate security alerts
   */
  private generateAlerts(
    piiDetections: PIIDetection[],
    classification: SecurityClassification
  ): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];

    // Alert for high-risk PII
    const highRiskPII = piiDetections.filter(d =>
      ['cpf', 'cnpj', 'credit_card', 'bank_account', 'password', 'api_key'].includes(d.type)
    );

    if (highRiskPII.length > 0) {
      alerts.push({
        type: 'pii_detected',
        severity: 'high',
        message: `Detected ${highRiskPII.length} high-risk PII item(s): ${highRiskPII.map(p => p.type).join(', ')}`,
        details: { detections: highRiskPII },
      });
    }

    // Alert for classification changes
    if (classification.level === 'secret') {
      alerts.push({
        type: 'classification_changed',
        severity: 'critical',
        message: 'Document classified as SECRET - requires special handling',
        details: { reasons: classification.reasons },
      });
    } else if (classification.level === 'confidential') {
      alerts.push({
        type: 'classification_changed',
        severity: 'medium',
        message: 'Document classified as CONFIDENTIAL - restrict access',
        details: { reasons: classification.reasons },
      });
    }

    return alerts;
  }

  /**
   * Validate specific PII formats
   */
  private validatePII(category: PIICategory, value: string): boolean {
    // Remove common separators
    const clean = value.replace(/[\.\-\s\/]/g, '');

    switch (category) {
      case 'cpf':
        return this.validateCPF(clean);
      case 'cnpj':
        return this.validateCNPJ(clean);
      default:
        return true;
    }
  }

  /**
   * Validate CPF (Brazilian individual taxpayer registry)
   */
  private validateCPF(cpf: string): boolean {
    if (cpf.length !== 11) return false;

    // Check for repeated digits
    if (/^(\d)\1+$/.test(cpf)) return false;

    // Validate check digits
    const add = (n: number) => n.toString().split('').reduce((a, b) => a + parseInt(b), 0);
    const mod = (n: number, m: number) => ((n % m) < 2 ? 0 : m - (n % m));

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let digit = mod(sum * 10, 11);
    if (digit !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    digit = mod(sum * 10, 11);
    return digit === parseInt(cpf[10]);
  }

  /**
   * Validate CNPJ (Brazilian company registry)
   */
  private validateCNPJ(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;

    if (/^(\d)\1+$/.test(cnpj)) return false;

    const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights[i + 1];
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cnpj[12])) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights[i];
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    return digit === parseInt(cnpj[13]);
  }

  /**
   * Mask PII value for safe display
   */
  private maskPII(value: string, category: PIICategory): string {
    if (value.length <= 4) return '*'.repeat(value.length);
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }

  /**
   * Calculate confidence score for PII detection
   */
  private calculateConfidence(category: PIICategory, value: string): number {
    // Higher confidence for validated formats
    if (['cpf', 'cnpj'].includes(category) && this.validatePII(category, value)) {
      return 0.95;
    }

    // High confidence for exact pattern matches
    if (['email', 'phone', 'credit_card'].includes(category)) {
      return 0.85;
    }

    // Medium confidence for contextual matches
    return 0.7;
  }

  /**
   * Detect text language (simple heuristic)
   */
  private detectLanguage(text: string): string {
    const portugueseWords = ['de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'não', 'uma'];
    const lowerText = text.toLowerCase();

    const ptCount = portugueseWords.filter(w => lowerText.includes(` ${w} `)).length;
    return ptCount > 2 ? 'pt-BR' : 'en';
  }
}

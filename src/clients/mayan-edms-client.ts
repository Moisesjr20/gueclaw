import axios, { AxiosInstance } from 'axios';

/**
 * Mayan EDMS Client - Document Management System
 * API: https://docs.mayan-edms.com
 */

export interface MayanDocument {
  id: number;
  uuid: string;
  label: string;
  language: string;
  uploaded: string;
  tags?: string[];
  documentType?: string;
}

export interface MayanSearchResult {
  id: number;
  label: string;
  uuid: string;
  latestVersionLabel: string;
  latestVersionCreated: string;
}

export interface MayanUploadOptions {
  filename?: string;
  description?: string;
  language?: string;
  documentType?: number;
  tags?: number[];
}

export interface MayanOCRResult {
  content: string;
  language: string;
  confidence?: number;
}

export class MayanEDMSClient {
  private client: AxiosInstance;
  private apiToken: string;

  constructor(
    baseURL: string,
    apiToken: string
  ) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 1 minute
    });
  }

  /**
   * Upload a document to Mayan EDMS
   */
  public async uploadDocument(
    fileBuffer: Buffer,
    options: MayanUploadOptions = {}
  ): Promise<MayanDocument> {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('file', blob, options.filename || 'document.pdf');

      if (options.description) {
        formData.append('description', options.description);
      }

      if (options.language) {
        formData.append('language', options.language);
      }

      if (options.documentType) {
        formData.append('document_type', options.documentType.toString());
      }

      if (options.tags && options.tags.length > 0) {
        formData.append('tags', JSON.stringify(options.tags));
      }

      // Mayan EDMS usa multipart/form-data para upload
      const response = await this.client.post('/documents/', formData, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return this.parseDocument(response.data);
    } catch (error: any) {
      console.error('❌ Mayan EDMS upload error:', error.response?.data || error.message);
      throw new Error(`Failed to upload document: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Search documents by query
   */
  public async searchDocuments(
    query: string,
    filters?: {
      documentType?: number;
      tags?: number[];
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<MayanSearchResult[]> {
    try {
      const params: any = { q: query };

      if (filters?.documentType) {
        params.document_type = filters.documentType;
      }

      if (filters?.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(',');
      }

      if (filters?.dateFrom) {
        params.date_from = filters.dateFrom;
      }

      if (filters?.dateTo) {
        params.date_to = filters.dateTo;
      }

      const response = await this.client.get('/documents/search/', { params });

      return response.data.results?.map((item: any) => ({
        id: item.id,
        label: item.label || 'Untitled',
        uuid: item.uuid,
        latestVersionLabel: item.latest_version?.label || 'v1',
        latestVersionCreated: item.latest_version?.created || item.created,
      })) || [];
    } catch (error: any) {
      console.error('❌ Mayan EDMS search error:', error.response?.data || error.message);
      throw new Error(`Failed to search documents: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get document details
   */
  public async getDocument(id: number): Promise<MayanDocument> {
    try {
      const response = await this.client.get(`/documents/${id}/`);
      return this.parseDocument(response.data);
    } catch (error: any) {
      console.error('❌ Mayan EDMS get document error:', error.response?.data || error.message);
      throw new Error(`Failed to get document: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get document OCR text
   */
  public async getDocumentOCR(id: number): Promise<MayanOCRResult> {
    try {
      const response = await this.client.get(`/documents/${id}/ocr/`);
      return {
        content: response.data.content || response.data.text || '',
        language: response.data.language || 'unknown',
        confidence: response.data.confidence,
      };
    } catch (error: any) {
      console.error('❌ Mayan EDMS OCR error:', error.response?.data || error.message);
      throw new Error(`Failed to get OCR: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get document file content
   */
  public async getDocumentFile(id: number): Promise<Buffer> {
    try {
      const response = await this.client.get(`/documents/${id}/download/`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('❌ Mayan EDMS download error:', error.response?.data || error.message);
      throw new Error(`Failed to download document: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Tag a document
   */
  public async tagDocument(id: number, tags: number[]): Promise<void> {
    try {
      await this.client.post(`/documents/${id}/tags/`, { tags });
    } catch (error: any) {
      console.error('❌ Mayan EDMS tag error:', error.response?.data || error.message);
      throw new Error(`Failed to tag document: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Delete a document
   */
  public async deleteDocument(id: number): Promise<void> {
    try {
      await this.client.delete(`/documents/${id}/`);
    } catch (error: any) {
      console.error('❌ Mayan EDMS delete error:', error.response?.data || error.message);
      throw new Error(`Failed to delete document: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * List available document types
   */
  public async getDocumentTypes(): Promise<Array<{ id: number; name: string; label: string }>> {
    try {
      const response = await this.client.get('/document_types/');
      return response.data.results?.map((dt: any) => ({
        id: dt.id,
        name: dt.name,
        label: dt.label,
      })) || [];
    } catch (error: any) {
      console.error('❌ Mayan EDMS document types error:', error.response?.data || error.message);
      throw new Error(`Failed to get document types: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * List available tags
   */
  public async getTags(): Promise<Array<{ id: number; label: string; color: string }>> {
    try {
      const response = await this.client.get('/tags/');
      return response.data.results?.map((tag: any) => ({
        id: tag.id,
        label: tag.label,
        color: tag.color,
      })) || [];
    } catch (error: any) {
      console.error('❌ Mayan EDMS tags error:', error.response?.data || error.message);
      throw new Error(`Failed to get tags: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/');
      return true;
    } catch (error: any) {
      console.error('❌ Mayan EDMS connection test failed:', error.message);
      return false;
    }
  }

  private parseDocument(data: any): MayanDocument {
    return {
      id: data.id,
      uuid: data.uuid,
      label: data.label || 'Untitled',
      language: data.language || 'eng',
      uploaded: data.created || data.uploaded,
      tags: data.tags?.map((t: any) => t.label) || [],
      documentType: data.document_type?.label,
    };
  }
}

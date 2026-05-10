export interface RagDocument {
  id: number;
  fileHash: string;
  originalFilename: string;
  storedPath: string;
  fileSizeBytes: number;
  tags: string[];
  securityLevel: 'public' | 'internal' | 'confidential' | 'secret';
  piiCount: number;
  indexedAt: Date;
  updatedAt: Date;
}

export interface RagChunk {
  id: number;
  fileHash: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, any>;
  indexedAt: Date;
}

export interface RagSearchResult {
  chunk: RagChunk;
  similarity: number;
  document: RagDocument;
}

export interface IndexingOptions {
  tags?: string[];
  description?: string;
  skipSecurity?: boolean;
}

export interface IndexingResult {
  success: boolean;
  fileHash: string;
  chunksIndexed: number;
  storedPath: string;
  securityLevel?: string;
  piiCount?: number;
  errors?: string[];
}

export interface SearchFilters {
  tags?: string[];
  securityLevel?: string;
  filename?: string;
}

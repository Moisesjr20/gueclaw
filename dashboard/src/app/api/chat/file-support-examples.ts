// 💬 Chat API Update - Suporte para File URLs
// Exemplo de como atualizar o endpoint de chat para processar arquivos
/* eslint-disable @typescript-eslint/no-unused-vars */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// ANTES (versão antiga):
/*
interface ChatRequest {
  userId: string;
  message: string;
  provider?: string;
}
*/

// DEPOIS (com suporte a arquivos):
interface ChatRequest {
  userId: string;
  message: string;
  fileUrls?: string[];  // ← NOVO: URLs dos arquivos enviados
  provider?: string;
}

// Exemplo de implementação no route handler:
export async function POST(req: NextRequest) {
  try {
    const { userId, message, fileUrls = [], provider } = await req.json();

    // 1. Processar arquivos anexados (se houver)
    let fileContext = '';
    
    if (fileUrls.length > 0) {
      console.log(`📎 Processing ${fileUrls.length} attachments...`);
      
      const fileContents = await Promise.all(
        fileUrls.map(async (url) => {
          try {
            // Se URL for local (/uploads/...)
            if (url.startsWith('/uploads/')) {
              const filepath = path.join(process.cwd(), 'public', url);
              const buffer = await fs.readFile(filepath);
              
              // Detectar tipo de arquivo
              const ext = path.extname(url).toLowerCase();
              
              if (['.txt', '.md', '.json', '.csv', '.js', '.ts', '.py'].includes(ext)) {
                // Texto: ler conteúdo
                const content = buffer.toString('utf-8');
                return `\n\n**File: ${path.basename(url)}**\n\`\`\`\n${content}\n\`\`\`\n`;
              } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                // Imagem: converter para base64 (opcional, se LLM suportar vision)
                const base64 = buffer.toString('base64');
                return `\n\n**Image: ${path.basename(url)}**\n[Image data: data:image/*;base64,${base64.slice(0, 100)}...]\n`;
              } else if (ext === '.pdf') {
                // PDF: extrair texto (usar lib como pdf-parse)
                // const pdfParse = require('pdf-parse');
                // const data = await pdfParse(buffer);
                // return `\n\n**PDF: ${path.basename(url)}**\n${data.text}\n`;
                return `\n\n**PDF: ${path.basename(url)}**\n[PDF content extraction would go here]\n`;
              }
            }
            
            return '';
          } catch (error) {
            console.error(`❌ Error processing file ${url}:`, error);
            return `\n\n**Error reading file: ${url}**\n`;
          }
        })
      );
      
      fileContext = fileContents.join('\n');
    }

    // 2. Construir contexto completo
    const fullMessage = fileContext 
      ? `${message}\n\n--- Attached Files ---${fileContext}`
      : message;

    // 3. Enviar para GueClaw agent
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        message: fullMessage,
        provider,
        metadata: {
          hasAttachments: fileUrls.length > 0,
          attachmentCount: fileUrls.length,
          attachmentUrls: fileUrls,
        },
      }),
    });

    const result = await response.json();

    return NextResponse.json({
      conversationId: result.conversationId,
      response: result.response,
      skillRouted: result.skillRouted,
      attachmentsProcessed: fileUrls.length,
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    );
  }
}

// ============================================
// EXEMPLO 2: Upload Inline (sem endpoint separado)
// ============================================

export async function POST_INLINE(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const userId = formData.get('userId') as string;
    const message = formData.get('message') as string;
    const provider = formData.get('provider') as string;
    const files = formData.getAll('files') as File[];

    // Processar arquivos diretamente
    let fileContext = '';
    
    if (files.length > 0) {
      const fileContents = await Promise.all(
        files.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          const content = buffer.toString('utf-8');
          return `\n\n**File: ${file.name}**\n\`\`\`\n${content}\n\`\`\`\n`;
        })
      );
      
      fileContext = fileContents.join('\n');
    }

    const fullMessage = fileContext 
      ? `${message}\n\n--- Attached Files ---${fileContext}`
      : message;

    // Enviar para GueClaw
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message: fullMessage, provider }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Chat error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    );
  }
}

// ============================================
// EXEMPLO 3: Com Extração de Texto de PDF
// ============================================

// Instalar: npm install pdf-parse
import pdfParse from 'pdf-parse';

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('❌ PDF parsing error:', error);
    return '[Failed to extract PDF text]';
  }
}

// Usar no processamento:
if (ext === '.pdf') {
  const text = await extractTextFromPDF(buffer);
  return `\n\n**PDF: ${path.basename(url)}**\n\`\`\`\n${text.slice(0, 5000)}\n\`\`\`\n`;
}

// ============================================
// EXEMPLO 4: Com Análise de Imagem (Vision API)
// ============================================

// Se o LLM suportar vision (ex: GPT-4 Vision, Claude 3)
if (['.png', '.jpg', '.jpeg'].includes(ext)) {
  const base64 = buffer.toString('base64');
  const dataUrl = `data:image/${ext.slice(1)};base64,${base64}`;
  
  // Adicionar imagem ao contexto de mensagem
  return {
    type: 'image',
    url: dataUrl,
    name: path.basename(url),
  };
}

// No request para LLM:
const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: message },
      ...imageAttachments.map(img => ({
        type: 'image_url',
        image_url: { url: img.url }
      }))
    ]
  }
];

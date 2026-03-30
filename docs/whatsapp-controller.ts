import { log } from "./logger";
import { google } from "googleapis";
import { transcribeAudioWithGemini } from "./gemini-service";

const REQUEST_TIMEOUT_MS = 60000;

// Estrutura CORRETA do webhook UazAPI (baseado nos logs)
export type UaizapiWebhookPayload = {
    EventType: string;  // "messages", "status", etc.
    instanceName: string;
    BaseUrl?: string;
    owner?: string;
    token?: string;
    chatSource?: string;
    chat?: {
        id?: string;
        name?: string;
        wa_chatid?: string;
        wa_isGroup?: boolean;
    };
    message: {
        messageid: string;
        chatid: string; // "553185887871@s.whatsapp.net"
        chatlid?: string;
        fromMe: boolean;
        messageType: string; // "AudioMessage", "Conversation", "StickerMessage", etc.
        senderName: string;
        sender_pn: string;
        sender_lid?: string;
        sender?: string;
        text?: string;
        content?: any;
        isGroup?: boolean;
        groupName?: string;
    };
};

const getRequiredEnv = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
};

// ==========================================
// Google Auth
// ==========================================
export const getGoogleApiClient = () => {
    const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
    const refreshToken = getRequiredEnv("GOOGLE_REFRESH_TOKEN");

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
};

// ==========================================
// Integrations
// ==========================================

export const logToGoogleSheets = async (payload: UaizapiWebhookPayload) => {
    const auth = getGoogleApiClient();
    const sheets = google.sheets({ version: "v4", auth });

    const id = payload.message.messageid;
    const name = payload.message.senderName || "Desconhecido";
    const text = payload.message.text || "";
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: "1jK1LWTHKQ3_OVNqZyg2pX2-hxZMId3Tc5Q9zZkkcu1E",
            range: "'Página1'!A:E",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[id, name, text, "", now]]
            }
        });
        log('INFO', `[WhatsApp Controller] Linha inserida no Sheets para: ${name}`);
    } catch (error: any) {
        log('ERROR', `[WhatsApp Controller] Erro no Google Sheets: ${error.message}`);
    }
};

export const downloadAudioAsBase64 = async (messageid: string): Promise<string> => {
    const token = getRequiredEnv("UAIZAPI_TOKEN");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch("https://kyrius.uazapi.com/message/download", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "token": token
        },
        body: JSON.stringify({
            id: messageid,
            return_base64: true
        }),
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
        throw new Error(`[Uaizapi] Download failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    let b64 = data.base64 || data.base64Data;
    if (typeof b64 === "string" && b64.includes("base64,")) {
        b64 = b64.split("base64,")[1];
    }
    
    if (!b64) {
        throw new Error(`[Uaizapi] Áudio vazio ou base64 não retornado pela API. Resposta bruta: ${JSON.stringify(data).slice(0, 200)}`);
    }
    
    return b64;
};

export const sendWhatsappMessage = async (number: string, text: string) => {
    const token = getRequiredEnv("UAIZAPI_TOKEN");

    const cleanNumber = number.split('@')[0];

    const response = await fetch("https://kyrius.uazapi.com/send/text", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "token": token
        },
        body: JSON.stringify({
            number: cleanNumber,
            text: text
        })
    });

    if (!response.ok) {
        throw new Error(`[Uaizapi] Send text failed: ${response.status} ${response.statusText}`);
    }
};

export const transcribeAndReplyAudio = async (payload: UaizapiWebhookPayload) => {
    const msgId = payload.message.messageid;
    const senderId = payload.message.sender_pn;
    const rawMimeType = payload.message.content?.mimetype || "audio/ogg";
    const mimeType = rawMimeType.split(";")[0].trim(); // Pega só 'audio/ogg' para evitar erros na Gemini

    log('INFO', `[WhatsApp Controller] Baixando audio ${msgId}...`);
    const base64Audio = await downloadAudioAsBase64(msgId);

    log('INFO', `[WhatsApp Controller] Transcrevendo com Gemini... (formato: ${mimeType})`);
    const transcript = await transcribeAudioWithGemini({
        prompt: "Transcreva o áudio de forma fiel e organizada.",
        base64Audio: base64Audio,
        mimeType: mimeType,
    });

    const replyText = `_Transcrição por IA Kyrius_ \n\n"${transcript}"`;

    log('INFO', `[WhatsApp Controller] Respondendo ${senderId}...`);
    await sendWhatsappMessage(senderId, replyText);
};

export const createTaskFromHashtag = async (payload: UaizapiWebhookPayload, hashtag: string) => {
    const text = payload.message.text || "";
    const auth = getGoogleApiClient();
    const tasksAPI = google.tasks({ version: "v1", auth });

    let targetListId = "@default";
    try {
        const lists = await tasksAPI.tasklists.list();
        const matchedList = lists.data.items?.find((v) => v.title?.includes(hashtag));
        if (matchedList?.id) {
            targetListId = matchedList.id;
        }
    } catch (err: any) {
        log('WARN', `[WhatsApp Controller] Erro ao listar TaskLists do Google: ${err.message}`);
    }

    let contextualText = text;
    const quoted = payload.message.content?.contextInfo?.quotedMessage;
    if (quoted?.conversation) {
        contextualText += ` - Ref: "${quoted.conversation}"`;
    } else if (quoted?.extendedTextMessage?.text) {
        contextualText += ` - Ref: "${quoted.extendedTextMessage.text}"`;
    }

    try {
        await tasksAPI.tasks.insert({
            tasklist: targetListId,
            requestBody: {
                title: `Task (${hashtag}) de WhatsApp`,
                notes: `Criada pelo FluxoHub Controlador. Referência:\n${contextualText}`,
            }
        });
        log('INFO', `[WhatsApp Controller] Tarefa criada para hashtag ${hashtag}.`);
    } catch (error: any) {
        log('ERROR', `[WhatsApp Controller] Erro ao criar task: ${error.message}`);
    }
};

// ==========================================
// Roteador Principal
// ==========================================

export const processWhatsappPayload = async (payload: UaizapiWebhookPayload) => {
    // Verifica se é um evento de mensagem válido
    if (!payload || !payload.message) {
        log('INFO', `[WhatsApp Controller] Recebeu webhook ignorado. Evento: ${payload?.EventType || "Desconhecido"}`);
        return;
    }

    // Só processa eventos do tipo "messages"
    if (payload.EventType !== "messages") {
        log('INFO', `[WhatsApp Controller] Ignorando evento tipo: ${payload.EventType}`);
        return;
    }

    const msg = payload.message;
    log('INFO', `[WhatsApp Controller] Processando mensagem de: ${msg.senderName || msg.sender_pn} (Tipo: ${msg.messageType})`);
    
    const chatid = msg.chatid || "";
    const isFromMe = msg.fromMe === true;
    const text = msg.text || "";
    const type = msg.messageType || "";

    // 1. Planilha (Salvar Emojis de Urgência no grupo GS)
    if (chatid === "120363163357097178@g.us") {
        const emojisUrgentes = ["🛑", "⚫", "🔴"];
        if (emojisUrgentes.some(e => text.includes(e))) {
            await logToGoogleSheets(payload);
        }
        return;
    }

    // 2. Transcrição de Áudio (se não for de grupo e não for enviada por mim)
    if (type === "AudioMessage" && !isFromMe && !chatid.includes("g.us")) {
        try {
            await transcribeAndReplyAudio(payload);
            log('INFO', `[WhatsApp Controller] Áudio transcrito com sucesso para ${msg.sender_pn}`);
        } catch (error: any) {
            log('ERROR', `[WhatsApp Controller] Erro ao transcrever áudio: ${error.message}`);
        }
        return;
    }

    // 3. Tarefas Hashtag
    const taskTags = ["#UP", "#NUP", "#UNP", "#NUNP"];
    const matchedTag = taskTags.find(tag => text.includes(tag));
    if (matchedTag) {
        await createTaskFromHashtag(payload, matchedTag);
    }
};

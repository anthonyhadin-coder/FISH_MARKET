import { GoogleGenAI, Type, Schema } from '@google/genai';
import { logger } from '../utils/logger';

// Initialize the SDK. If GEMINI_API_KEY is not provided, it will throw an error or fail gracefully
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'missing-key' });

export interface ParsedVoiceData {
    transcript: string;
    isSale: boolean;
    saleDetails?: {
        buyerName?: string;
        fishSpecies?: string;
        weightKg?: number;
        priceTotal?: number;
    } | null;
}

export const aiService = {
    /**
     * Transcribes an audio buffer using Whisper, and parses it into structured JSON using Gemini 2.5 Flash.
     */
    async transcribeAndParseAudio(buffer: Buffer, mimeType: string): Promise<ParsedVoiceData> {
        if (!process.env.OPENAI_API_KEY || !process.env.GEMINI_API_KEY) {
            logger.warn('OPENAI_API_KEY or GEMINI_API_KEY is not set. Using mock parsing.');
            return {
                transcript: 'Simulation: Voice parsing successful (No API Key)',
                isSale: true,
                saleDetails: { buyerName: 'John Doe', fishSpecies: 'Tuna', weightKg: 5, priceTotal: 100 }
            };
        }

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                transcript: { type: Type.STRING, description: "The exact transcript of what was spoken in the audio. Include original Tamil if spoken." },
                isSale: { type: Type.BOOLEAN, description: "True if the audio describes a fish sale transaction." },
                saleDetails: {
                    type: Type.OBJECT,
                    properties: {
                        buyerName: { type: Type.STRING, description: "Name of the buyer, if mentioned." },
                        fishSpecies: { type: Type.STRING, description: "Type of fish sold (e.g. Parai)." },
                        weightKg: { type: Type.NUMBER, description: "Total weight of the fish sold in kilograms." },
                        priceTotal: { type: Type.NUMBER, description: "Total price of the sale. If rate is given, calculate total." }
                    },
                    nullable: true
                }
            },
            required: ['transcript', 'isSale']
        };

        try {
            logger.info(`Sending audio to Whisper: type=${mimeType}, size=${buffer.length} bytes`);
            
            // 1. Transcribe with Whisper
            const formData = new FormData();
            const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
            formData.append('file', blob, 'audio.webm');
            formData.append('model', 'whisper-1');

            let transcript = '';
            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                body: formData as any
            });

            if (!whisperRes.ok) {
                const errText = await whisperRes.text();
                logger.warn(`Whisper API failed (Likely Quota Exceeded). Falling back to Gemini Native Audio: ${errText}`);
                
                // FALLBACK: Use Gemini directly on the audio
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: 'Analyze this audio log from a fish market agent. Extract the transcript exactly (including any Tamil or English spoken), determine if it represents a sale, and extract the sale details if so. If they say "Parai 50 rupees 260 kilo", calculate priceTotal = 50 * 260 = 13000.' },
                                { inlineData: { data: buffer.toString('base64'), mimeType: mimeType } }
                            ]
                        }
                    ],
                    config: { responseMimeType: 'application/json', responseSchema }
                });

                if (!response.text) throw new Error('No text returned from Gemini Fallback API');
                return JSON.parse(response.text) as ParsedVoiceData;
            }

            const whisperData = await whisperRes.json();
            transcript = whisperData.text;

            if (!transcript) {
                throw new Error('No text returned from Whisper API');
            }
            
            logger.info(`Whisper Transcription: "${transcript}"`);

            // 2. Parse with Gemini (if Whisper succeeded)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `Analyze this transcript from a fish market agent. Extract the transcript exactly, determine if it represents a sale, and extract the sale details if so.\n\nTranscript: "${transcript}"` }
                        ]
                    }
                ],
                config: { responseMimeType: 'application/json', responseSchema }
            });

            if (!response.text) throw new Error('No text returned from Gemini API');
            return JSON.parse(response.text) as ParsedVoiceData;

        } catch (error: any) {
            logger.error(`Error parsing audio: ${error.message}`);
            throw error;
        }
    }
};

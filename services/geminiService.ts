import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import type { CalendarEvent } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const eventModel = 'gemini-2.5-pro';
const defaultModel = 'gemini-2.5-flash';

const createCalendarEventFunction: FunctionDeclaration = {
    name: 'create_calendar_event',
    description: 'Creates a Google Calendar event from the provided details.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: {
                type: Type.STRING,
                description: 'The title of the event.',
            },
            start_time: {
                type: Type.STRING,
                description: 'The start time of the event in ISO 8601 format (e.g., "2024-07-21T10:00:00Z").',
            },
            end_time: {
                type: Type.STRING,
                description: 'The end time of the event in ISO 8601 format (e.g., "2024-07-21T11:00:00Z").',
            },
            location: {
                type: Type.STRING,
                description: 'The location of the event.',
            },
            description: {
                type: Type.STRING,
                description: 'A brief description of the event.',
            },
        },
        required: ['title', 'start_time'],
    },
};

export const analyzeTextForEvent = async (text: string): Promise<CalendarEvent | null> => {
    try {
        const today = new Date().toISOString();
        const prompt = `Your task is to analyze the following text to identify and extract details for a calendar event.
Today's date is ${today}. Use this for resolving relative dates like "tomorrow" or "next Friday".
Be flexible and infer details where possible. For example, if a year isn't mentioned, assume the current year. If a time is mentioned without AM/PM, infer based on context (e.g., 'meeting at 9' is likely 9 AM).
If you find event details, use the create_calendar_event tool. If no event is described, do not call the tool.

Text to analyze: "${text}"`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: eventModel,
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: [createCalendarEventFunction] }],
            },
        });

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'create_calendar_event') {
                return call.args as CalendarEvent;
            }
        }
        return null;
    } catch (error) {
        console.error("Error analyzing text for event:", error);
        throw error;
    }
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType,
            },
        };
        const textPart = {
            text: prompt,
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: defaultModel,
            contents: { parts: [imagePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing image:", error);
        throw new Error("Failed to analyze image. Please check the console for details.");
    }
};

export const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

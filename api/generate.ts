import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// IMPORTANT: Do NOT hardcode your API key here.
// Vercel will inject it from your project's Environment Variables.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Allow requests from any origin (CORS)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests for CORS
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const { model, contents, config } = request.body;

    if (!model || !contents) {
      return response.status(400).json({ error: { message: 'Missing required parameters: model and contents' } });
    }

    const geminiResponse = await ai.models.generateContent({ model, contents, config });

    // The response from the SDK is a class instance. We send back the plain object version.
    return response.status(200).json(geminiResponse);

  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return response.status(500).json({ error: { message: errorMessage } });
  }
}


import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error('GOOGLE_API_KEY is missing in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// We need to access the model manager if available exposed, or just try to list models via a raw request if the SDK doesn't expose it directly in the high-level client easily.
// Checking SDK docs pattern: usually there isn't a direct listModels on the main client in some versions, but let's try the standard way if available or use the model manager.
// Actually, looking at the error message, it suggests Call ListModels.
// The nodejs SDK usually has a `getGenerativeModel` but listing might be on the GoogleAIFileManager or similar, OR we might just have to fetch it via REST if the SDK doesn't expose it in the main entry point easily.
// HOWEVER, looking at recent SDK versions, there might not be a direct listModels method on the top-level class.
// Let's try to use the raw API if needed, but first let's try to see if we can find it.
// Actually, the error `[GoogleGenerativeAI Error]: ... Call ListModels ...` suggests it is an API operation.

// Let's try to use a simple fetch to the API endpoint to list models since the SDK might hide it or I might not recall the exact method name on the version installed.
// URL: https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const models = data.models || [];

        console.log('Available Models:');
        const visionModels = models.filter((m: any) => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'));

        visionModels.forEach((model: any) => {
            console.log(`- ${model.name}`);
            console.log(`  Description: ${model.description}`);
            console.log(`  Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
            console.log('---');
        });

        if (visionModels.length === 0) {
            console.log('No Gemini models found that support generateContent.');
            console.log('All models:', models.map((m: any) => m.name));
        }

    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();

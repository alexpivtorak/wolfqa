
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testConnection() {
    const apiKey = process.env.GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    console.log(`Testing connection with model: ${modelName}`);

    if (!apiKey) {
        console.error('❌ GOOGLE_API_KEY is missing');
        process.exit(1);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent('Hello, are you working?');
        const response = await result.response;
        const text = response.text();

        console.log('✅ Connection successful!');
        console.log('Response:', text);
    } catch (error: any) {
        console.error('❌ Connection failed:', error.message);
        if (error.message.includes('404')) {
            console.error('Tip: The model might not exist or isn\'t available for your API key.');
        }
    }
}

testConnection();

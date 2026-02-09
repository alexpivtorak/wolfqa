import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const key = process.env.GOOGLE_API_KEY;
if (!key) {
    console.error('No GOOGLE_API_KEY found');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);

const modelsToTest = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-001',
    'gemini-1.0-pro',
    'gemini-pro'
];

async function test() {
    console.log('Testing models with API Key ending in ...' + key?.slice(-4));

    for (const modelName of modelsToTest) {
        console.log(`\nTesting: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Hello, are you there?');
            const response = await result.response;
            console.log(`✅ SUCCESS: ${modelName}`);
            console.log(`Response: ${response.text().slice(0, 50)}...`);
        } catch (error: any) {
            console.log(`❌ FAILED: ${modelName}`);
            console.log(`Error: ${error.message.split('\n')[0]}`); // First line only
        }
    }
}

test();

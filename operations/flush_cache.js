
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.resolve(__dirname, '../cache/action_cache.json');
const TARGET_URL_KEYWORD = 'saucedemo';

function flushCache() {
    if (!fs.existsSync(CACHE_FILE)) {
        console.log('❌ Cache file not found:', CACHE_FILE);
        return;
    }

    try {
        const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
        const cache = JSON.parse(rawData);
        const originalCount = Object.keys(cache).length;

        let deletedCount = 0;
        const newCache = {};

        for (const [key, value] of Object.entries(cache)) {
            let isSauceDemo = false;

            // Heuristic: Check if any 'navigate' action in the cached steps points to saucedemo
            if (value.actions && Array.isArray(value.actions)) {
                for (const action of value.actions) {
                    if (action.type === 'navigate' && action.text && action.text.toLowerCase().includes(TARGET_URL_KEYWORD)) {
                        isSauceDemo = true;
                        break;
                    }
                }
            }

            if (isSauceDemo) {
                console.log(`🗑️ Removing cache entry: ${key} (Detected SauceDemo navigation)`);
                deletedCount++;
            } else {
                newCache[key] = value;
            }
        }

        if (deletedCount === 0) {
            console.log('⚠️ No specific SauceDemo cache entries found (based on navigate actions).');
            if (originalCount > 0) {
                console.log(`ℹ️ Cache has ${originalCount} entries. To force clear ALL, run with --all`);
                if (process.argv.includes('--all')) {
                    fs.writeFileSync(CACHE_FILE, '{}');
                    console.log('🔥 CLEARED ALL CACHE ENTRIES.');
                    return;
                }
            }
        } else {
            console.log(`✅ Removed ${deletedCount} SauceDemo entries.`);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(newCache, null, 2));
        }

    } catch (e) {
        console.error('Failed to flush cache:', e);
    }
}

flushCache();

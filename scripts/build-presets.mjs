import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(ROOT_DIR, 'assets', 'presets', 'default');
const MANIFEST_PATH = path.join(ROOT_DIR, 'assets', 'presets', 'manifest.json');

const VALID_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);

function sortKey(filename) {
    const match = filename.match(/^(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function parseFilename(filename) {
    const match = filename.match(/^(\d+)[-_](.+)\.[^.]+$/);
    if (match) {
        return {
            id: match[1],
            name: match[2].trim()
        };
    }
    const base = path.basename(filename, path.extname(filename)).trim();
    return {
        id: base,
        name: base
    };
}

function loadExistingKeywords() {
    const keywordMap = new Map();
    if (!fs.existsSync(MANIFEST_PATH)) {
        return keywordMap;
    }
    try {
        const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (item && typeof item.name === 'string' && Array.isArray(item.keywords)) {
                    keywordMap.set(item.name, item.keywords);
                }
            }
        }
    } catch (err) {
        console.warn(`[build-presets] Failed to read existing manifest keywords: ${err.message}`);
    }
    return keywordMap;
}

function buildPresetsManifest() {
    if (!fs.existsSync(PRESETS_DIR)) {
        fs.mkdirSync(PRESETS_DIR, { recursive: true });
    }

    const existingKeywords = loadExistingKeywords();
    const files = fs
        .readdirSync(PRESETS_DIR)
        .filter((file) => VALID_EXTS.has(path.extname(file).toLowerCase()))
        .sort((a, b) => {
            const diff = sortKey(a) - sortKey(b);
            return diff !== 0 ? diff : a.localeCompare(b, 'zh-CN');
        });

    const manifest = files.map((filename) => {
        const { id, name } = parseFilename(filename);
        return {
            id,
            name,
            filename,
            path: `assets/presets/default/${filename}`,
            tag: `[表情: ${name}]`,
            keywords: existingKeywords.get(name) || []
        };
    });

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`[build-presets] Synced ${manifest.length} preset memes to ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
}

buildPresetsManifest();

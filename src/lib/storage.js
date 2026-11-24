import {
    getExtensionUrl,
    hasLocalStorageApi,
    storageGet,
    storageSet,
    onStorageChanged
} from './ext-api.js';

export const STORAGE_KEY_CUSTOM = 'gmp_custom_memes';
export const STORAGE_KEY_AUTOSEND = 'gmp_auto_send';
export const STORAGE_KEY_SIZES = 'gmp_size_settings';

const IDB_NAME = 'gmp_meme_picker_db';
const IDB_STORE = 'kv';

export const DEFAULT_SIZE_SETTINGS = Object.freeze({
    standalone: 140,
    inline: 72,
    assistantMax: 160
});

export const SIZE_LIMITS = Object.freeze({
    standalone: Object.freeze({ min: 80, max: 240, step: 4 }),
    inline: Object.freeze({ min: 40, max: 140, step: 4 }),
    assistantMax: Object.freeze({ min: 100, max: 260, step: 4 })
});

export const SIZE_PRESETS = Object.freeze([
    Object.freeze({ id: 'sm', label: '小', standalone: 110, inline: 52, assistantMax: 130 }),
    Object.freeze({ id: 'md', label: '中', standalone: 140, inline: 72, assistantMax: 160 }),
    Object.freeze({ id: 'lg', label: '大', standalone: 180, inline: 96, assistantMax: 200 }),
    Object.freeze({ id: 'xl', label: '超大', standalone: 220, inline: 120, assistantMax: 240 })
]);

let defaultPresetsCache = [];
let customMemesCache = [];
let autoSendCache = true;
let sizeSettingsCache = normalizeSizeSettings(DEFAULT_SIZE_SETTINGS);
let unwatchStorage = null;
const changeListeners = new Set();

function clampNumber(val, { min, max }, fallback) {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

export function normalizeSizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const standalone = clampNumber(src.standalone, SIZE_LIMITS.standalone, DEFAULT_SIZE_SETTINGS.standalone);
    const inline = clampNumber(src.inline, SIZE_LIMITS.inline, DEFAULT_SIZE_SETTINGS.inline);
    const assistantMax = clampNumber(
        src.assistantMax,
        SIZE_LIMITS.assistantMax,
        DEFAULT_SIZE_SETTINGS.assistantMax
    );
    const multi = Math.max(72, Math.round(standalone * 0.8));
    return { standalone, multi, inline, assistantMax };
}

export function applySizeCssVars(settings) {
    const normalized = normalizeSizeSettings(settings || sizeSettingsCache);
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
        const style = document.documentElement.style;
        style.setProperty('--gmp-size-standalone', `${normalized.standalone}px`);
        style.setProperty('--gmp-size-multi', `${normalized.multi}px`);
        style.setProperty('--gmp-size-inline', `${normalized.inline}px`);
        style.setProperty('--gmp-size-assistant-max', `${normalized.assistantMax}px`);
    }
    return normalized;
}

function notifyListeners(reason) {
    changeListeners.forEach((fn) => {
        try {
            fn({
                reason,
                customMemes: customMemesCache,
                autoSend: autoSendCache,
                sizeSettings: sizeSettingsCache
            });
        } catch (err) {
            console.warn('[GeminiMemePicker] Storage listener error:', err);
        }
    });
}

function openFallbackDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key) {
    const db = await openFallbackDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(key, value) {
    const db = await openFallbackDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const req = tx.objectStore(IDB_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function readKey(key, fallbackValue) {
    if (hasLocalStorageApi()) {
        const res = await storageGet([key]);
        if (res && res[key] !== undefined) {
            return res[key];
        }
        return fallbackValue;
    }

    try {
        const idbVal = await idbGet(key);
        if (idbVal !== undefined) return idbVal;
    } catch (_) {
        // Fall through to localStorage
    }

    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        }
    } catch (_) {
        // Ignore
    }
    return fallbackValue;
}

async function writeKey(key, value) {
    if (hasLocalStorageApi()) {
        await storageSet({ [key]: value });
        return;
    }

    try {
        await idbSet(key, value);
        return;
    } catch (_) {
        // Fall through to localStorage
    }

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

function hydratePresetsList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => ({
        id: String(item.id || item.name),
        name: String(item.name || '').trim(),
        filename: item.filename || '',
        path: item.path || '',
        tag: item.tag || `[表情: ${String(item.name || '').trim()}]`,
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        preview: item.path ? getExtensionUrl(item.path) : ''
    }));
}

export async function loadPresets(presetsData) {
    if (Array.isArray(presetsData)) {
        defaultPresetsCache = hydratePresetsList(presetsData);
        return defaultPresetsCache;
    }
    if (typeof fetch !== 'function') {
        return defaultPresetsCache;
    }
    try {
        const manifestUrl = getExtensionUrl('assets/presets/manifest.json');
        const resp = await fetch(manifestUrl);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const list = await resp.json();
        defaultPresetsCache = hydratePresetsList(list);
    } catch (err) {
        console.warn('[GeminiMemePicker] Failed to load presets manifest:', err);
    }
    return defaultPresetsCache;
}

export async function init(presetsData) {
    await loadPresets(presetsData);
    const [storedCustom, storedAutoSend, storedSizes] = await Promise.all([
        readKey(STORAGE_KEY_CUSTOM, []),
        readKey(STORAGE_KEY_AUTOSEND, true),
        readKey(STORAGE_KEY_SIZES, DEFAULT_SIZE_SETTINGS)
    ]);
    customMemesCache = Array.isArray(storedCustom) ? storedCustom : [];
    autoSendCache = storedAutoSend !== false;
    sizeSettingsCache = applySizeCssVars(storedSizes);

    if (unwatchStorage) {
        unwatchStorage();
    }
    unwatchStorage = onStorageChanged((changes) => {
        let changed = false;
        if (changes[STORAGE_KEY_CUSTOM]) {
            const nextVal = changes[STORAGE_KEY_CUSTOM].newValue;
            customMemesCache = Array.isArray(nextVal) ? nextVal : [];
            changed = true;
        }
        if (changes[STORAGE_KEY_AUTOSEND]) {
            autoSendCache = changes[STORAGE_KEY_AUTOSEND].newValue !== false;
            changed = true;
        }
        if (changes[STORAGE_KEY_SIZES]) {
            sizeSettingsCache = applySizeCssVars(changes[STORAGE_KEY_SIZES].newValue);
            changed = true;
        }
        if (changed) {
            notifyListeners('external');
        }
    });

    return {
        defaultMemes: defaultPresetsCache,
        customMemes: customMemesCache,
        autoSend: autoSendCache,
        sizeSettings: sizeSettingsCache
    };
}

export function getDefaultMemes() {
    return defaultPresetsCache;
}

export function getCustomMemes() {
    return customMemesCache;
}

export function getAutoSend() {
    return autoSendCache;
}

export function getSizeSettings() {
    return sizeSettingsCache;
}

export async function setAutoSend(value) {
    autoSendCache = Boolean(value);
    await writeKey(STORAGE_KEY_AUTOSEND, autoSendCache);
    notifyListeners('autosend');
    return autoSendCache;
}

export async function setSizeSettings(partialOrFull) {
    const merged = {
        ...sizeSettingsCache,
        ...(partialOrFull && typeof partialOrFull === 'object' ? partialOrFull : {})
    };
    sizeSettingsCache = applySizeCssVars(merged);
    await writeKey(STORAGE_KEY_SIZES, {
        standalone: sizeSettingsCache.standalone,
        inline: sizeSettingsCache.inline,
        assistantMax: sizeSettingsCache.assistantMax
    });
    notifyListeners('sizes');
    return sizeSettingsCache;
}

export async function resetSizeSettings() {
    return setSizeSettings(DEFAULT_SIZE_SETTINGS);
}

export async function saveCustomMemes(list) {
    customMemesCache = Array.isArray(list) ? list : [];
    await writeKey(STORAGE_KEY_CUSTOM, customMemesCache);
    notifyListeners('custom');
    return customMemesCache;
}

export function compressImageFile(file, maxSize = 240) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('File read failed'));
        reader.onload = (e) => {
            const rawUrl = e.target.result;
            if (file.type === 'image/gif' && file.size <= 1024 * 1024) {
                resolve(rawUrl);
                return;
            }
            const img = new Image();
            img.onerror = () => reject(new Error('Image decode failed'));
            img.onload = () => {
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                if (!w || !h) {
                    resolve(rawUrl);
                    return;
                }
                if (w > maxSize || h > maxSize) {
                    const scale = maxSize / Math.max(w, h);
                    w = Math.max(1, Math.round(w * scale));
                    h = Math.max(1, Math.round(h * scale));
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const webpUrl = canvas.toDataURL('image/webp', 0.85);
                resolve(webpUrl.startsWith('data:image/webp') ? webpUrl : canvas.toDataURL('image/png'));
            };
            img.src = rawUrl;
        };
        reader.readAsDataURL(file);
    });
}

export function sanitizeName(filename) {
    const stripped = String(filename || '')
        .replace(/\.[^/.]+$/, '')
        .replace(/[\[\]]/g, '')
        .trim();
    return stripped || 'sticker';
}

export async function importFiles(files) {
    if (!files || !files.length) {
        return { added: 0, skipped: 0, items: [] };
    }
    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter((f) => f && f.type && f.type.startsWith('image/'));
    let skipped = allFiles.length - imageFiles.length;

    if (!imageFiles.length) {
        return { added: 0, skipped, items: [] };
    }

    const results = await Promise.allSettled(
        imageFiles.map(async (file) => {
            const name = sanitizeName(file.name);
            const dataUri = await compressImageFile(file, 240);
            return {
                id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                tag: `[表情: ${name}]`,
                keywords: [name.toLowerCase()],
                preview: dataUri,
                createdAt: Date.now()
            };
        })
    );

    const newItems = [];
    for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
            newItems.push(res.value);
        } else {
            skipped += 1;
        }
    }

    if (newItems.length > 0) {
        const nextList = [...customMemesCache, ...newItems];
        await saveCustomMemes(nextList);
    }

    return {
        added: newItems.length,
        skipped,
        items: newItems
    };
}

export async function deleteCustomMeme(id) {
    const nextList = customMemesCache.filter((m) => m.id !== id);
    await saveCustomMemes(nextList);
    return nextList;
}

export async function renameCustomMeme(id, nextNameRaw) {
    const nextName = sanitizeName(nextNameRaw);
    if (!nextName) return customMemesCache;
    const nextList = customMemesCache.map((m) => {
        if (m.id !== id) return m;
        return {
            ...m,
            name: nextName,
            tag: `[表情: ${nextName}]`,
            keywords: Array.from(
                new Set([...(Array.isArray(m.keywords) ? m.keywords : []), nextName.toLowerCase()])
            )
        };
    });
    await saveCustomMemes(nextList);
    return nextList;
}

export function filterMemes(memes, query) {
    if (!Array.isArray(memes)) return [];
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return memes;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return memes.filter((meme) => {
        if (!meme) return false;
        const fields = [
            meme.name || '',
            meme.tag || '',
            ...(Array.isArray(meme.keywords) ? meme.keywords : [])
        ]
            .join(' ')
            .toLowerCase();
        return tokens.every((token) => fields.includes(token));
    });
}

export function onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
}

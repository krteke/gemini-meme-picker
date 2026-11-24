// Cross-browser WebExtension API helper supporting both Firefox (`browser.*` Promises)
// and Chromium (`chrome.*` callback or Promise) as well as Node test environments.

export function getExtensionApi() {
    if (typeof globalThis !== 'undefined') {
        if (globalThis.browser && globalThis.browser.runtime) {
            return globalThis.browser;
        }
        if (globalThis.chrome && globalThis.chrome.runtime) {
            return globalThis.chrome;
        }
    }
    return null;
}

export function getExtensionUrl(relPath) {
    const normalized = String(relPath || '').replace(/^\/+/, '');
    const api = getExtensionApi();
    if (api && api.runtime && typeof api.runtime.getURL === 'function') {
        return api.runtime.getURL(normalized);
    }
    return normalized;
}

export function hasLocalStorageApi() {
    const api = getExtensionApi();
    return Boolean(api && api.storage && api.storage.local && typeof api.storage.local.get === 'function');
}

export function storageGet(keys) {
    const api = getExtensionApi();
    if (!api || !api.storage || !api.storage.local) {
        return Promise.resolve({});
    }
    return new Promise((resolve) => {
        try {
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                resolve(result && typeof result === 'object' ? result : {});
            };
            const maybePromise = api.storage.local.get(keys, (result) => {
                if (api.runtime && api.runtime.lastError) {
                    done({});
                    return;
                }
                done(result);
            });
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(done, () => done({}));
            }
        } catch (_) {
            resolve({});
        }
    });
}

export function storageSet(items) {
    const api = getExtensionApi();
    if (!api || !api.storage || !api.storage.local) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        try {
            let settled = false;
            const finish = (err) => {
                if (settled) return;
                settled = true;
                if (err) reject(err);
                else resolve();
            };
            const maybePromise = api.storage.local.set(items, () => {
                if (api.runtime && api.runtime.lastError) {
                    finish(new Error(api.runtime.lastError.message));
                    return;
                }
                finish(null);
            });
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(
                    () => finish(null),
                    (err) => finish(err)
                );
            }
        } catch (err) {
            reject(err);
        }
    });
}

export function onStorageChanged(listener) {
    const api = getExtensionApi();
    if (!api || !api.storage || !api.storage.onChanged || typeof listener !== 'function') {
        return () => {};
    }
    const handler = (changes, areaName) => {
        if (areaName !== 'local') return;
        listener(changes);
    };
    api.storage.onChanged.addListener(handler);
    return () => {
        try {
            api.storage.onChanged.removeListener(handler);
        } catch (_) {
            // Ignore
        }
    };
}

export async function openTab(url) {
    const api = getExtensionApi();
    if (api && api.tabs && typeof api.tabs.create === 'function') {
        try {
            const res = api.tabs.create({ url });
            if (res && typeof res.then === 'function') {
                await res;
            }
            return true;
        } catch (_) {
            // Fall through to window.open
        }
    }
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
    }
    return false;
}

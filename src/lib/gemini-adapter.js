const EDITOR_SELECTORS = [
    'rich-textarea .ql-editor[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"][role="textbox"]',
    'rich-textarea [contenteditable="true"]',
    'input-area-v2 [contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]'
];

const SEND_BUTTON_SELECTORS = [
    'button.send-button:not(.stop)',
    'button[data-test-id="send-button"]',
    '.send-button-container button:not(.stop)',
    'button[aria-label*="Send" i]',
    'button[aria-label*="发送"]'
];

const STOP_BUTTON_SELECTORS = [
    'button.send-button.stop',
    'button[aria-label*="Stop generating" i]',
    'button[aria-label*="Stop response" i]',
    'button[aria-label*="停止"]',
    'button .stop-icon'
];

function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function parseRgbLuminance(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
        return null;
    }
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function detectTheme() {
    const docEl = document.documentElement;
    const body = document.body;

    const classCandidates = [
        ...(body ? Array.from(body.classList) : []),
        ...(docEl ? Array.from(docEl.classList) : [])
    ].map((c) => c.toLowerCase());

    if (classCandidates.some((c) => c === 'dark-theme' || c === 'dark' || c.includes('dark-mode'))) {
        return 'dark';
    }
    if (classCandidates.some((c) => c === 'light-theme' || c === 'light' || c.includes('light-mode'))) {
        return 'light';
    }

    const attrTheme = (body && body.getAttribute('data-theme')) || (docEl && docEl.getAttribute('data-theme'));
    if (attrTheme === 'dark' || attrTheme === 'light') {
        return attrTheme;
    }

    const bgCandidates = [body, document.querySelector('chat-window'), document.querySelector('main')];
    for (const el of bgCandidates) {
        if (!el) continue;
        const lum = parseRgbLuminance(window.getComputedStyle(el).backgroundColor);
        if (lum !== null) {
            return lum < 0.5 ? 'dark' : 'light';
        }
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

export function findEditor() {
    for (const sel of EDITOR_SELECTORS) {
        const candidates = document.querySelectorAll(sel);
        for (const el of candidates) {
            if (isElementVisible(el)) return el;
        }
    }
    return null;
}

export function findTriggerMountPoint() {
    const leadingWrappers = document.querySelectorAll(
        'input-area-v2 .leading-actions-wrapper, .input-area-container .leading-actions-wrapper, .leading-actions-wrapper'
    );
    for (const wrapper of leadingWrappers) {
        if (!isElementVisible(wrapper)) continue;
        const uploader = wrapper.querySelector('uploader, [data-test-id="uploader-button-container"]');
        if (uploader && uploader.nextSibling) {
            return { container: wrapper, beforeEl: uploader.nextSibling, mode: 'leading' };
        }
        return { container: wrapper, beforeEl: null, mode: 'leading' };
    }

    const uploadBtns = document.querySelectorAll(
        'input-area-v2 uploader button, button[aria-label*="Upload" i], button[aria-label*="上传"], button[aria-label*="Add files" i], button[aria-label*="添加"]'
    );
    for (const uploadBtn of uploadBtns) {
        if (!isElementVisible(uploadBtn)) continue;
        const uploaderHost = uploadBtn.closest('uploader') || uploadBtn;
        const parent = uploaderHost.parentElement;
        if (parent) {
            return { container: parent, beforeEl: uploaderHost.nextSibling, mode: 'adjacent' };
        }
    }

    const trailingWrappers = document.querySelectorAll(
        'input-area-v2 .input-buttons-wrapper-bottom, .input-area-container .input-buttons-wrapper-bottom, .trailing-actions-wrapper'
    );
    for (const wrapper of trailingWrappers) {
        if (!isElementVisible(wrapper)) continue;
        return { container: wrapper, beforeEl: wrapper.firstChild, mode: 'trailing' };
    }

    const editor = findEditor();
    if (editor) {
        const area =
            editor.closest('input-area-v2') ||
            editor.closest('.input-area-container') ||
            editor.closest('.text-input-field');
        if (area) {
            return { container: area, beforeEl: null, mode: 'fallback' };
        }
    }

    return null;
}

export function isGenerating() {
    for (const sel of STOP_BUTTON_SELECTORS) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const btn = el.closest('button') || el;
        if (isElementVisible(btn)) return true;
    }
    return false;
}

export function findSendButton() {
    for (const sel of SEND_BUTTON_SELECTORS) {
        const candidates = document.querySelectorAll(sel);
        for (const btn of candidates) {
            if (!isElementVisible(btn)) continue;
            if (btn.classList.contains('stop')) continue;
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('stop') || label.includes('停止')) continue;
            return btn;
        }
    }
    return null;
}

function isButtonEnabled(btn) {
    if (!btn || btn.disabled) return false;
    const ariaDisabled = btn.getAttribute('aria-disabled');
    return ariaDisabled !== 'true';
}

function ensureCaretInEditor(editor) {
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0) {
        const anchor = sel.anchorNode;
        if (anchor && editor.contains(anchor)) {
            return;
        }
    }
    const range = document.createRange();
    const paragraphs = editor.querySelectorAll('p');
    const target = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : editor;
    range.selectNodeContents(target);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

export function insertText(text) {
    const editor = findEditor();
    if (!editor) return false;

    editor.focus();
    ensureCaretInEditor(editor);

    const beforeText = editor.textContent || '';

    // 1. Primary path: execCommand lets Quill & Angular update internal model cleanly
    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, text);
    } catch (_) {
        inserted = false;
    }

    if (
        inserted &&
        (editor.textContent || '').includes(text.trim()) &&
        (editor.textContent || '').length > beforeText.length
    ) {
        return true;
    }

    // 2. Fallback: ClipboardEvent paste (best-effort across Chromium & Firefox)
    try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvt = new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true
        });
        editor.dispatchEvent(pasteEvt);
        if ((editor.textContent || '').length > beforeText.length) {
            return true;
        }
    } catch (_) {
        // Fall through to DOM fallback
    }

    // 3. Final fallback: safe DOM text node insertion + InputEvent
    let targetBlock = editor.querySelector('p:last-of-type');
    if (!targetBlock) {
        targetBlock = document.createElement('p');
        editor.appendChild(targetBlock);
    }
    const br = targetBlock.querySelector('br:only-child');
    if (br) {
        br.remove();
    }
    const textNode = document.createTextNode(text);
    targetBlock.appendChild(textNode);
    editor.classList.remove('ql-blank');

    const sel = window.getSelection();
    if (sel) {
        const range = document.createRange();
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    editor.dispatchEvent(
        new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
        })
    );
    return true;
}

export function submitEditor() {
    if (isGenerating()) return Promise.resolve(false);
    const editor = findEditor();
    if (!editor) return Promise.resolve(false);

    return new Promise((resolve) => {
        const start = Date.now();
        const trySubmit = () => {
            if (isGenerating()) {
                resolve(false);
                return;
            }
            const sendBtn = findSendButton();
            if (sendBtn && isButtonEnabled(sendBtn)) {
                sendBtn.click();
                resolve(true);
                return;
            }
            if (Date.now() - start >= 450) {
                editor.focus();
                const enterEvt = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                editor.dispatchEvent(enterEvt);
                resolve(true);
                return;
            }
            setTimeout(trySubmit, 50);
        };
        setTimeout(trySubmit, 40);
    });
}

(() => {
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    const GMP = (root.__GMP = root.__GMP || {});

    const TAG_REGEX = /\[表情\s*[:：]\s*([^\]]+)\]/g;
    const ALT_PREFIX_REGEX = /^(?:表情|meme|sticker)\s*[:：\s]/i;
    const SKIP_ANCESTOR_SELECTOR = 'code, pre, textarea, input, [contenteditable="true"], #gmp-meme-picker';
    const HIDDEN_TEXT_ANCESTOR_SELECTOR =
        '.cdk-visually-hidden, .visually-hidden, .sr-only, [aria-hidden="true"], button, mat-icon, svg, style, script';
    const MESSAGE_CONTAINER_SELECTOR = 'user-query, model-response, message-content, .conversation-container';

    const FALLBACK_SIZES = {
        standalone: 140,
        multi: 112,
        inline: 72,
        assistantMax: 160
    };

    function getActiveSizeSettings(sizeSettings) {
        if (sizeSettings && typeof sizeSettings === 'object') {
            return {
                standalone: Number(sizeSettings.standalone) || FALLBACK_SIZES.standalone,
                multi:
                    Number(sizeSettings.multi) ||
                    Math.max(72, Math.round((Number(sizeSettings.standalone) || FALLBACK_SIZES.standalone) * 0.8)),
                inline: Number(sizeSettings.inline) || FALLBACK_SIZES.inline,
                assistantMax: Number(sizeSettings.assistantMax) || FALLBACK_SIZES.assistantMax
            };
        }
        if (GMP.storage && typeof GMP.storage.getSizeSettings === 'function') {
            return GMP.storage.getSizeSettings();
        }
        return FALLBACK_SIZES;
    }

    function buildMemeLookup(defaultMemes = [], customMemes = []) {
        const memeMap = Object.create(null);
        const memeNames = new Set();

        for (const item of [...defaultMemes, ...customMemes]) {
            if (!item || !item.name || !item.preview) continue;
            const name = String(item.name).trim();
            if (!name) continue;
            memeMap[name] = item.preview;
            memeNames.add(name);
        }

        return { memeMap, memeNames };
    }

    function isHiddenOrSkippedElement(el) {
        if (!el || typeof el.closest !== 'function') return false;
        return Boolean(el.closest(SKIP_ANCESTOR_SELECTOR) || el.closest(HIDDEN_TEXT_ANCESTOR_SELECTOR));
    }

    function collectEligibleTextNodes(el) {
        if (!el) return [];
        const nodes = [];
        if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            let current;
            while ((current = walker.nextNode())) {
                if (!current.nodeValue) continue;
                if (current.parentElement && isHiddenOrSkippedElement(current.parentElement)) {
                    continue;
                }
                nodes.push(current);
            }
            return nodes;
        }

        // Lightweight recursive fallback for non-browser unit tests
        function visit(node, hidden) {
            if (!node) return;
            if (node.nodeType === 3) {
                if (!hidden && node.nodeValue) nodes.push(node);
                return;
            }
            if (node.nodeType === 1) {
                const cls = String(node.className || '');
                const tag = String(node.tagName || '').toLowerCase();
                const isSkipped =
                    hidden ||
                    tag === 'code' ||
                    tag === 'pre' ||
                    tag === 'textarea' ||
                    tag === 'input' ||
                    tag === 'button' ||
                    tag === 'svg' ||
                    tag === 'style' ||
                    tag === 'script' ||
                    cls.includes('cdk-visually-hidden') ||
                    cls.includes('visually-hidden') ||
                    cls.includes('sr-only') ||
                    (typeof node.getAttribute === 'function' &&
                        (node.getAttribute('aria-hidden') === 'true' ||
                            node.getAttribute('contenteditable') === 'true'));
                const children = node.childNodes || [];
                for (const child of children) {
                    visit(child, isSkipped);
                }
            }
        }
        visit(el, false);
        return nodes;
    }

    function getVisibleText(el) {
        return collectEligibleTextNodes(el)
            .map((node) => node.nodeValue || '')
            .join('');
    }

    function extractValidTags(text, memeMap) {
        if (!text || !text.includes('[表情')) return [];
        const regex = new RegExp(TAG_REGEX.source, 'g');
        const matches = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            const name = match[1].trim();
            if (memeMap && memeMap[name]) {
                matches.push({
                    raw: match[0],
                    name,
                    index: match.index,
                    length: match[0].length
                });
            }
        }
        return matches;
    }

    function classifyTextBlock(text, memeMap, sizeSettings) {
        if (!text || !text.includes('[表情')) {
            return { kind: 'none', names: [], size: 0 };
        }
        const regex = new RegExp(TAG_REGEX.source, 'g');
        const allTags = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            allTags.push(match[1].trim());
        }
        if (allTags.length === 0) {
            return { kind: 'none', names: [], size: 0 };
        }

        const validNames = allTags.filter((name) => Boolean(memeMap && memeMap[name]));
        if (validNames.length === 0) {
            return { kind: 'none', names: [], size: 0 };
        }

        const sizes = getActiveSizeSettings(sizeSettings);
        const remainingText = text.replace(new RegExp(TAG_REGEX.source, 'g'), '').trim();
        if (!remainingText && validNames.length === allTags.length) {
            const size = validNames.length === 1 ? sizes.standalone : sizes.multi;
            return { kind: 'standalone', names: validNames, size };
        }

        return { kind: 'inline', names: validNames, size: sizes.inline };
    }

    function isAssistantStickerAlt(alt, memeNames) {
        const trimmed = String(alt || '').trim();
        if (!trimmed) return false;
        if (memeNames && memeNames.has(trimmed)) return true;
        return ALT_PREFIX_REGEX.test(trimmed);
    }

    function createStickerImg(src, name, variantOrSize, isInlineFlag) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = name;
        img.title = `[表情: ${name}]`;
        img.loading = 'lazy';
        img.decoding = 'async';

        let variant = variantOrSize;
        if (typeof variantOrSize === 'number') {
            variant = isInlineFlag ? 'inline' : variantOrSize <= 115 ? 'multi' : 'single';
        }

        if (variant === 'inline') {
            img.className = 'gmp-sticker-img gmp-sticker-inline';
        } else if (variant === 'multi') {
            img.className = 'gmp-sticker-img gmp-sticker-standalone gmp-sticker-standalone-multi';
        } else {
            img.className = 'gmp-sticker-img gmp-sticker-standalone gmp-sticker-standalone-single';
        }
        return img;
    }

    function findSegmentPosition(segments, globalOffset) {
        for (let i = 0; i < segments.length; i += 1) {
            const seg = segments[i];
            if (globalOffset >= seg.start && globalOffset <= seg.end) {
                return { node: seg.node, offset: globalOffset - seg.start };
            }
        }
        const last = segments[segments.length - 1];
        return last ? { node: last.node, offset: last.end - last.start } : null;
    }

    function pruneEmptyInlineWrappers(el, rootLimit) {
        let cur = el;
        while (cur && cur !== rootLimit && cur.nodeType === Node.ELEMENT_NODE) {
            const parent = cur.parentElement;
            if (
                cur.tagName === 'SPAN' &&
                !cur.classList.contains('cdk-visually-hidden') &&
                cur.childElementCount === 0 &&
                !(cur.textContent || '')
            ) {
                cur.remove();
                cur = parent;
            } else {
                break;
            }
        }
    }

    function replaceInlineMemesInElement(el, memeMap) {
        if (!el || isHiddenOrSkippedElement(el)) return false;

        const textNodes = collectEligibleTextNodes(el);
        if (textNodes.length === 0) return false;

        const segments = [];
        let fullText = '';
        for (const node of textNodes) {
            const val = node.nodeValue || '';
            const start = fullText.length;
            fullText += val;
            segments.push({ node, start, end: fullText.length });
        }

        if (!fullText.includes('[表情')) return false;

        const matches = extractValidTags(fullText, memeMap);
        if (matches.length === 0) return false;

        for (let i = matches.length - 1; i >= 0; i -= 1) {
            const m = matches[i];
            const startPos = findSegmentPosition(segments, m.index);
            const endPos = findSegmentPosition(segments, m.index + m.length);
            if (!startPos || !endPos) continue;

            const stickerImg = createStickerImg(memeMap[m.name], m.name, 'inline');

            if (startPos.node === endPos.node) {
                const textNode = startPos.node;
                const val = textNode.nodeValue || '';
                const frag = document.createDocumentFragment();
                const before = val.slice(0, startPos.offset);
                const after = val.slice(endPos.offset);
                if (before) frag.appendChild(document.createTextNode(before));
                frag.appendChild(stickerImg);
                if (after) frag.appendChild(document.createTextNode(after));
                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(frag, textNode);
                }
            } else if (typeof document.createRange === 'function') {
                const startParent = startPos.node.parentElement;
                const endParent = endPos.node.parentElement;
                const range = document.createRange();
                range.setStart(startPos.node, startPos.offset);
                range.setEnd(endPos.node, endPos.offset);
                range.deleteContents();
                range.insertNode(stickerImg);
                pruneEmptyInlineWrappers(startParent, el);
                pruneEmptyInlineWrappers(endParent, el);
            }
        }

        return true;
    }

    function collectMatchingElements(rootEl, selector) {
        const list = [];
        if (!rootEl) return list;
        if (rootEl.matches && rootEl.matches(selector)) {
            list.push(rootEl);
        }
        if (rootEl.querySelectorAll) {
            rootEl.querySelectorAll(selector).forEach((el) => list.push(el));
        }
        return list;
    }

    function renderStandaloneGroup(containerEl, names, memeMap, alignRight) {
        const preservedHidden = Array.from(containerEl.children).filter(
            (child) =>
                child.matches &&
                child.matches('.cdk-visually-hidden, .visually-hidden, .sr-only')
        );

        const variant = names.length === 1 ? 'single' : 'multi';
        const wrap = document.createElement('div');
        wrap.className = alignRight
            ? 'gmp-standalone-stickers gmp-standalone-right'
            : 'gmp-standalone-stickers gmp-standalone-left';

        for (const name of names) {
            wrap.appendChild(createStickerImg(memeMap[name], name, variant));
        }

        containerEl.replaceChildren(...preservedHidden, wrap);
    }

    function markUserStickerBubble(queryTextEl, isStandaloneOnly) {
        const userQueryRoot = queryTextEl.closest('user-query, .user-query-container') || queryTextEl.parentElement;
        const candidates = new Set();

        const namedSelectors = [
            '.user-query-bubble-with-background',
            '.user-query-bubble',
            '[class*="user-query-bubble"]',
            '.query-content'
        ];
        for (const sel of namedSelectors) {
            const match = queryTextEl.closest(sel);
            if (match) candidates.add(match);
        }

        let cur = queryTextEl;
        while (cur && cur !== userQueryRoot && cur instanceof Element) {
            if (isStandaloneOnly && typeof window !== 'undefined' && window.getComputedStyle) {
                const bg = window.getComputedStyle(cur).backgroundColor;
                if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                    candidates.add(cur);
                }
            }
            cur = cur.parentElement;
        }

        candidates.forEach((el) => {
            if (isStandaloneOnly) {
                el.classList.add('gmp-sticker-only-bubble');
            } else {
                el.classList.remove('gmp-sticker-only-bubble');
            }
        });
    }

    function renderUserQueries(rootEl, memeMap) {
        const scanRoot =
            rootEl instanceof Element
                ? rootEl.closest('user-query, .user-query-container') || rootEl
                : rootEl;

        const queryTextSet = new Set(collectMatchingElements(scanRoot, '.query-text, [id^="user-query-content"]'));
        collectMatchingElements(scanRoot, 'user-query .query-text-line').forEach((line) => {
            const parent = line.closest('.query-text') || line.parentElement;
            if (parent) queryTextSet.add(parent);
        });

        for (const queryTextEl of queryTextSet) {
            if (isHiddenOrSkippedElement(queryTextEl)) continue;
            if (queryTextEl.querySelector('code, pre')) continue;

            const existingStandalone = queryTextEl.querySelector('.gmp-standalone-stickers');
            const visibleText = getVisibleText(queryTextEl);
            if (!visibleText.includes('[表情')) continue;

            const hasExistingInline = Boolean(queryTextEl.querySelector('.gmp-sticker-inline'));
            if (!existingStandalone && !hasExistingInline) {
                const classification = classifyTextBlock(visibleText, memeMap);
                if (classification.kind === 'standalone') {
                    renderStandaloneGroup(queryTextEl, classification.names, memeMap, true);
                    markUserStickerBubble(queryTextEl, true);
                    continue;
                }
            }

            if (replaceInlineMemesInElement(queryTextEl, memeMap)) {
                markUserStickerBubble(queryTextEl, false);
            }
        }
    }

    function constrainAssistantMedia(rootEl, memeNames) {
        const scanRoot =
            rootEl instanceof Element
                ? rootEl.closest('model-response, message-content, .model-response-text, .markdown') || rootEl
                : rootEl;

        const responseContainers = collectMatchingElements(
            scanRoot,
            'model-response, message-content, .model-response-text, .markdown, .markdown-main-panel'
        );

        const images = new Set();
        for (const container of responseContainers) {
            container.querySelectorAll('img[alt]').forEach((img) => images.add(img));
        }
        if (scanRoot instanceof Element && scanRoot.matches('img[alt]')) {
            const insideModel = scanRoot.closest('model-response, message-content, .model-response-text, .markdown');
            if (insideModel) images.add(scanRoot);
        }

        for (const img of images) {
            if (img.classList.contains('gmp-sticker-img') || img.classList.contains('gmp-assistant-sticker-img')) {
                continue;
            }
            if (img.closest('#gmp-meme-picker, button, .avatar, .bard-avatar')) continue;

            const alt = img.getAttribute('alt') || '';
            if (!isAssistantStickerAlt(alt, memeNames)) continue;

            img.classList.add('gmp-assistant-sticker-img');
            const parentWrap = img.closest('generated-image, single-image, .image-container, figure');
            if (parentWrap) {
                parentWrap.classList.add('gmp-assistant-sticker-wrap');
            }
        }
    }

    function renderAssistantBlocks(rootEl, memeMap) {
        const scanRoot =
            rootEl instanceof Element
                ? rootEl.closest('model-response, message-content, .model-response-text, .markdown, .markdown-main-panel') ||
                  rootEl
                : rootEl;

        const blockSelector = [
            'model-response p',
            'model-response li',
            'model-response blockquote',
            'model-response td',
            'model-response th',
            'message-content p',
            'message-content li',
            'message-content blockquote',
            '.markdown p',
            '.markdown li',
            '.markdown blockquote',
            '.markdown-main-panel p',
            '.markdown-main-panel li',
            '.response-content p',
            '.response-content li'
        ].join(', ');

        const blocks = collectMatchingElements(scanRoot, blockSelector);
        for (const block of blocks) {
            if (isHiddenOrSkippedElement(block)) continue;
            if (block.closest('.query-text, user-query')) continue;

            const visibleText = getVisibleText(block);
            if (!visibleText.includes('[表情')) continue;

            const hasCodeChild = Boolean(block.querySelector('code, pre'));
            const existingStandalone = block.querySelector(':scope > .gmp-standalone-stickers');

            if (existingStandalone) {
                const trailingMatches = extractValidTags(visibleText, memeMap);
                if (
                    trailingMatches.length > 0 &&
                    !visibleText.replace(new RegExp(TAG_REGEX.source, 'g'), '').trim()
                ) {
                    for (const m of trailingMatches) {
                        existingStandalone.appendChild(createStickerImg(memeMap[m.name], m.name, 'multi'));
                    }
                    const imgs = existingStandalone.querySelectorAll('.gmp-sticker-standalone');
                    if (imgs.length > 1) {
                        imgs.forEach((img) => {
                            img.classList.remove('gmp-sticker-standalone-single');
                            img.classList.add('gmp-sticker-standalone-multi');
                        });
                    }
                    Array.from(block.childNodes).forEach((child) => {
                        if (child !== existingStandalone && child.nodeType === Node.TEXT_NODE) {
                            child.nodeValue = '';
                        }
                    });
                    continue;
                }
            }

            const hasExistingInline = Boolean(block.querySelector('.gmp-sticker-inline'));
            const hasNonTextNonSpanChildren = Array.from(block.children).some(
                (child) =>
                    !child.classList.contains('gmp-standalone-stickers') &&
                    child.tagName !== 'SPAN' &&
                    child.tagName !== 'STRONG' &&
                    child.tagName !== 'EM'
            );

            if (!hasCodeChild && !hasExistingInline && !hasNonTextNonSpanChildren) {
                const classification = classifyTextBlock(visibleText, memeMap);
                if (classification.kind === 'standalone') {
                    renderStandaloneGroup(block, classification.names, memeMap, false);
                    continue;
                }
            }

            replaceInlineMemesInElement(block, memeMap);
        }
    }

    function renderChatMemes(rootEl = document, memesBundle) {
        const storage = GMP.storage;
        const defaultMemes = memesBundle ? memesBundle.defaultMemes : storage ? storage.getDefaultMemes() : [];
        const customMemes = memesBundle ? memesBundle.customMemes : storage ? storage.getCustomMemes() : [];
        const { memeMap, memeNames } = buildMemeLookup(defaultMemes, customMemes);

        if (Object.keys(memeMap).length === 0) return;

        const targetRoot =
            rootEl instanceof Element
                ? rootEl.closest(MESSAGE_CONTAINER_SELECTOR) || rootEl
                : rootEl;

        constrainAssistantMedia(targetRoot, memeNames);
        renderUserQueries(targetRoot, memeMap);
        renderAssistantBlocks(targetRoot, memeMap);
    }

    GMP.renderer = {
        TAG_REGEX,
        buildMemeLookup,
        getVisibleText,
        extractValidTags,
        classifyTextBlock,
        isAssistantStickerAlt,
        createStickerImg,
        replaceInlineMemesInElement,
        renderChatMemes
    };
})();

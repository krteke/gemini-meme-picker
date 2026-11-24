(() => {
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    if (root.__geminiMemePickerLoaded) return;
    root.__geminiMemePickerLoaded = true;

    const GMP = root.__GMP;
    if (!GMP || !GMP.storage || !GMP.adapter || !GMP.renderer || !GMP.picker) {
        return;
    }

    const MESSAGE_CONTAINER_SELECTOR = 'user-query, model-response, message-content, .conversation-container';
    const pendingElements = new Set();
    let rafScheduled = false;
    let trailingTimerShort = null;
    let trailingTimerLong = null;
    let wasGenerating = false;

    function getConversationRoot() {
        return document.querySelector('chat-window, infinite-scroller, main') || document;
    }

    function resolveMessageTarget(node) {
        if (!node) return null;
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!el) return null;
        if (el.id === 'gmp-meme-picker' || el.id === 'gmp-trigger-btn') return null;
        return el.closest(MESSAGE_CONTAINER_SELECTOR) || el;
    }

    function runConversationSweep() {
        GMP.picker.mountTriggerButton();
        GMP.picker.applyThemeAttributes();
        GMP.renderer.renderChatMemes(getConversationRoot());
    }

    function scheduleTrailingSweep() {
        if (trailingTimerShort) clearTimeout(trailingTimerShort);
        if (trailingTimerLong) clearTimeout(trailingTimerLong);
        trailingTimerShort = setTimeout(runConversationSweep, 250);
        trailingTimerLong = setTimeout(runConversationSweep, 850);
    }

    function schedulePostSendRender() {
        setTimeout(runConversationSweep, 120);
        setTimeout(runConversationSweep, 450);
        setTimeout(runConversationSweep, 1000);
    }

    GMP.schedulePostSendRender = schedulePostSendRender;

    function scheduleFlush() {
        if (rafScheduled) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
            rafScheduled = false;
            GMP.picker.mountTriggerButton();
            GMP.picker.applyThemeAttributes();

            pendingElements.forEach((el) => {
                if (el && el.isConnected) {
                    GMP.renderer.renderChatMemes(el);
                }
            });
            pendingElements.clear();

            const nowGenerating = GMP.adapter.isGenerating();
            if (wasGenerating && !nowGenerating) {
                runConversationSweep();
                setTimeout(runConversationSweep, 300);
            }
            wasGenerating = nowGenerating;
        });
    }

    function setupGlobalListeners() {
        document.addEventListener(
            'pointerdown',
            (e) => {
                if (!GMP.picker.isOpen()) return;
                const picker = document.getElementById('gmp-meme-picker');
                const trigger = document.getElementById('gmp-trigger-btn');
                if ((picker && picker.contains(e.target)) || (trigger && trigger.contains(e.target))) {
                    return;
                }
                GMP.picker.closePicker();
            },
            true
        );

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !GMP.picker.isOpen()) return;
            if (GMP.picker.isSettingsOpen && GMP.picker.isSettingsOpen()) {
                GMP.picker.closeSettingsMenu();
                return;
            }
            GMP.picker.closePicker();
        });

        window.addEventListener('resize', () => {
            if (GMP.picker.isOpen()) {
                GMP.picker.positionPicker(document.getElementById('gmp-trigger-btn'));
            }
        });
    }

    function startObservers() {
        const domObserver = new MutationObserver((mutations) => {
            let hasWork = false;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const added of m.addedNodes) {
                        const target = resolveMessageTarget(added);
                        if (target) {
                            pendingElements.add(target);
                            hasWork = true;
                        }
                    }
                    if (m.target) {
                        const target = resolveMessageTarget(m.target);
                        if (target && target.closest(MESSAGE_CONTAINER_SELECTOR)) {
                            pendingElements.add(target);
                            hasWork = true;
                        }
                    }
                } else if (m.type === 'characterData' && m.target) {
                    const target = resolveMessageTarget(m.target);
                    if (target) {
                        pendingElements.add(target);
                        hasWork = true;
                    }
                }
            }
            if (hasWork) {
                scheduleFlush();
                scheduleTrailingSweep();
            }
        });

        if (document.body) {
            domObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        const themeObserver = new MutationObserver(() => {
            GMP.picker.applyThemeAttributes();
        });
        if (document.documentElement) {
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'data-theme']
            });
        }
        if (document.body) {
            themeObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'data-theme']
            });
        }
    }

    async function bootstrap() {
        setupGlobalListeners();
        await GMP.storage.init();
        GMP.storage.applySizeCssVars();

        GMP.picker.mountTriggerButton();
        runConversationSweep();

        GMP.storage.onChange(() => {
            GMP.storage.applySizeCssVars();
            GMP.picker.refresh();
            runConversationSweep();
        });

        startObservers();
    }

    bootstrap().catch((err) => {
        console.warn('[GeminiMemePicker] Bootstrap error:', err);
    });
})();

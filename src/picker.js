(() => {
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    const GMP = (root.__GMP = root.__GMP || {});

    const SVG_NS = 'http://www.w3.org/2000/svg';

    let pickerEl = null;
    let settingsMenuEl = null;
    let settingsBtnEl = null;
    let currentPack = 'default';
    let searchQuery = '';
    let toastTimer = null;
    let editingId = null;

    function createSvgIcon(width, height, viewBox, buildFn) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        buildFn(svg);
        return svg;
    }

    function createSmileSvg() {
        return createSvgIcon(20, 20, '0 0 24 24', (svg) => {
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '9.25');
            circle.setAttribute('stroke', 'currentColor');
            circle.setAttribute('stroke-width', '1.8');

            const leftEye = document.createElementNS(SVG_NS, 'circle');
            leftEye.setAttribute('cx', '8.75');
            leftEye.setAttribute('cy', '9.75');
            leftEye.setAttribute('r', '1.25');
            leftEye.setAttribute('fill', 'currentColor');

            const rightEye = document.createElementNS(SVG_NS, 'circle');
            rightEye.setAttribute('cx', '15.25');
            rightEye.setAttribute('cy', '9.75');
            rightEye.setAttribute('r', '1.25');
            rightEye.setAttribute('fill', 'currentColor');

            const smile = document.createElementNS(SVG_NS, 'path');
            smile.setAttribute('d', 'M8 14.3C9.1 16.5 11.1 17.5 12 17.5C12.9 17.5 14.9 16.5 16 14.3');
            smile.setAttribute('stroke', 'currentColor');
            smile.setAttribute('stroke-width', '1.8');
            smile.setAttribute('stroke-linecap', 'round');

            svg.append(circle, leftEye, rightEye, smile);
        });
    }

    function createSearchSvg() {
        return createSvgIcon(14, 14, '0 0 24 24', (svg) => {
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', '11');
            circle.setAttribute('cy', '11');
            circle.setAttribute('r', '7.5');
            circle.setAttribute('stroke', 'currentColor');
            circle.setAttribute('stroke-width', '2');

            const handle = document.createElementNS(SVG_NS, 'path');
            handle.setAttribute('d', 'M20 20L16.5 16.5');
            handle.setAttribute('stroke', 'currentColor');
            handle.setAttribute('stroke-width', '2');
            handle.setAttribute('stroke-linecap', 'round');

            svg.append(circle, handle);
        });
    }

    function createSettingsSvg() {
        return createSvgIcon(15, 15, '0 0 24 24', (svg) => {
            const center = document.createElementNS(SVG_NS, 'circle');
            center.setAttribute('cx', '12');
            center.setAttribute('cy', '12');
            center.setAttribute('r', '3.25');
            center.setAttribute('stroke', 'currentColor');
            center.setAttribute('stroke-width', '1.8');

            const teeth = document.createElementNS(SVG_NS, 'path');
            teeth.setAttribute(
                'd',
                'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z'
            );
            teeth.setAttribute('stroke', 'currentColor');
            teeth.setAttribute('stroke-width', '1.7');
            teeth.setAttribute('stroke-linecap', 'round');
            teeth.setAttribute('stroke-linejoin', 'round');

            svg.append(center, teeth);
        });
    }

    function applyThemeAttributes() {
        const theme = GMP.adapter ? GMP.adapter.detectTheme() : 'dark';
        const btn = document.getElementById('gmp-trigger-btn');
        if (btn) btn.setAttribute('data-theme', theme);
        if (pickerEl) pickerEl.setAttribute('data-theme', theme);
    }

    function showToast(message) {
        if (!pickerEl) return;
        const toastEl = pickerEl.querySelector('.gmp-toast');
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('visible');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            if (toastEl) toastEl.classList.remove('visible');
        }, 2200);
    }

    function isSettingsOpen() {
        return Boolean(settingsMenuEl && !settingsMenuEl.hidden);
    }

    function closeSettingsMenu() {
        if (settingsMenuEl) {
            settingsMenuEl.hidden = true;
        }
        if (settingsBtnEl) {
            settingsBtnEl.setAttribute('aria-expanded', 'false');
            settingsBtnEl.classList.remove('active');
        }
    }

    function syncSettingsMenuUi(settingsOverride) {
        if (!settingsMenuEl) return;
        const s = settingsOverride || GMP.storage.getSizeSettings();

        const presets = GMP.storage.SIZE_PRESETS || [];
        settingsMenuEl.querySelectorAll('.gmp-size-preset-btn').forEach((chip) => {
            const preset = presets.find((p) => p.id === chip.dataset.presetId);
            const isActive = Boolean(
                preset &&
                    preset.standalone === s.standalone &&
                    preset.inline === s.inline &&
                    preset.assistantMax === s.assistantMax
            );
            chip.classList.toggle('active', isActive);
        });

        const fields = ['standalone', 'inline', 'assistantMax'];
        for (const key of fields) {
            const slider = settingsMenuEl.querySelector(`input[data-size-key="${key}"]`);
            const readout = settingsMenuEl.querySelector(`.gmp-size-value[data-size-key="${key}"]`);
            if (slider) slider.value = String(s[key]);
            if (readout) {
                readout.textContent =
                    key === 'standalone' ? `${s.standalone}px (连发 ${s.multi}px)` : `${s[key]}px`;
            }
        }
    }

    function buildSettingsMenu() {
        const menu = document.createElement('div');
        menu.className = 'gmp-settings-menu';
        menu.setAttribute('role', 'region');
        menu.setAttribute('aria-label', '表情显示大小设置');
        menu.hidden = true;

        const header = document.createElement('div');
        header.className = 'gmp-settings-header';

        const title = document.createElement('span');
        title.className = 'gmp-settings-title';
        title.textContent = '表情显示大小';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'gmp-settings-reset';
        resetBtn.textContent = '恢复默认';
        resetBtn.addEventListener('click', async () => {
            const next = await GMP.storage.resetSizeSettings();
            syncSettingsMenuUi(next);
            showToast('已恢复默认大小');
        });

        header.append(title, resetBtn);

        const presetRow = document.createElement('div');
        presetRow.className = 'gmp-size-presets';
        const presets = GMP.storage.SIZE_PRESETS || [];
        for (const preset of presets) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'gmp-size-preset-btn';
            chip.dataset.presetId = preset.id;
            chip.textContent = preset.label;
            chip.addEventListener('click', async () => {
                const next = await GMP.storage.setSizeSettings({
                    standalone: preset.standalone,
                    inline: preset.inline,
                    assistantMax: preset.assistantMax
                });
                syncSettingsMenuUi(next);
            });
            presetRow.appendChild(chip);
        }

        const slidersWrap = document.createElement('div');
        slidersWrap.className = 'gmp-size-sliders';

        const limits = GMP.storage.SIZE_LIMITS || {
            standalone: { min: 80, max: 240, step: 4 },
            inline: { min: 40, max: 140, step: 4 },
            assistantMax: { min: 100, max: 260, step: 4 }
        };

        const sliderConfigs = [
            { key: 'standalone', label: '单独发送贴纸', limit: limits.standalone },
            { key: 'inline', label: '图文混排行内', limit: limits.inline },
            { key: 'assistantMax', label: '助手媒体上限', limit: limits.assistantMax }
        ];

        const draftSizes = () => {
            const cur = GMP.storage.getSizeSettings();
            const next = {
                standalone: cur.standalone,
                inline: cur.inline,
                assistantMax: cur.assistantMax
            };
            menu.querySelectorAll('input[data-size-key]').forEach((input) => {
                next[input.dataset.sizeKey] = Number(input.value);
            });
            return next;
        };

        for (const cfg of sliderConfigs) {
            const row = document.createElement('div');
            row.className = 'gmp-size-row';

            const labelLine = document.createElement('div');
            labelLine.className = 'gmp-size-label-line';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = cfg.label;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'gmp-size-value';
            valueSpan.dataset.sizeKey = cfg.key;

            labelLine.append(nameSpan, valueSpan);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'gmp-size-slider';
            slider.dataset.sizeKey = cfg.key;
            slider.min = String(cfg.limit.min);
            slider.max = String(cfg.limit.max);
            slider.step = String(cfg.limit.step);

            slider.addEventListener('input', () => {
                const previewSizes = GMP.storage.applySizeCssVars(draftSizes());
                syncSettingsMenuUi(previewSizes);
            });

            slider.addEventListener('change', async () => {
                const saved = await GMP.storage.setSizeSettings(draftSizes());
                syncSettingsMenuUi(saved);
            });

            row.append(labelLine, slider);
            slidersWrap.appendChild(row);
        }

        menu.append(header, presetRow, slidersWrap);
        return menu;
    }

    function toggleSettingsMenu() {
        if (!settingsMenuEl) return;
        const willOpen = settingsMenuEl.hidden;
        if (willOpen) {
            syncSettingsMenuUi();
            settingsMenuEl.hidden = false;
            if (settingsBtnEl) {
                settingsBtnEl.setAttribute('aria-expanded', 'true');
                settingsBtnEl.classList.add('active');
            }
        } else {
            closeSettingsMenu();
        }
    }

    function closePicker() {
        editingId = null;
        settingsMenuEl = null;
        settingsBtnEl = null;
        if (pickerEl && pickerEl.parentElement) {
            pickerEl.parentElement.removeChild(pickerEl);
            pickerEl = null;
        }
        const btn = document.getElementById('gmp-trigger-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('active');
        }
    }

    function positionPicker(triggerBtn) {
        if (!pickerEl || !triggerBtn) return;
        const rect = triggerBtn.getBoundingClientRect();
        const pickerWidth = Math.min(436, window.innerWidth - 20);
        const pickerHeight = pickerEl.offsetHeight || 384;

        let left = rect.left - 8;
        if (left + pickerWidth > window.innerWidth - 12) {
            left = window.innerWidth - pickerWidth - 12;
        }
        if (left < 12) left = 12;

        const spaceAbove = rect.top - 12;
        if (spaceAbove >= pickerHeight || spaceAbove >= 260) {
            pickerEl.style.top = 'auto';
            pickerEl.style.bottom = `${window.innerHeight - rect.top + 10}px`;
        } else {
            pickerEl.style.bottom = 'auto';
            pickerEl.style.top = `${Math.min(rect.bottom + 10, window.innerHeight - pickerHeight - 12)}px`;
        }
        pickerEl.style.left = `${left}px`;
    }

    function getFilteredList() {
        const storage = GMP.storage;
        const source = currentPack === 'default' ? storage.getDefaultMemes() : storage.getCustomMemes();
        return storage.filterMemes(source, searchQuery);
    }

    function updateTabBadges() {
        if (!pickerEl) return;
        const defaultTab = pickerEl.querySelector('[data-pack="default"]');
        const customTab = pickerEl.querySelector('[data-pack="custom"]');
        const defaultCount = GMP.storage.getDefaultMemes().length;
        const customCount = GMP.storage.getCustomMemes().length;

        if (defaultTab) {
            defaultTab.textContent = `默认 (${defaultCount})`;
            defaultTab.classList.toggle('active', currentPack === 'default');
        }
        if (customTab) {
            customTab.textContent = `我的收藏 (${customCount})`;
            customTab.classList.toggle('active', currentPack === 'custom');
        }
    }

    async function handleMemeSelect(meme, isShiftClick) {
        const adapter = GMP.adapter;
        const autoSend = GMP.storage.getAutoSend();
        const shouldSend = isShiftClick ? !autoSend : autoSend;
        const tagText = meme.tag || `[表情: ${meme.name}]`;

        const inserted = adapter.insertText(tagText);
        if (!inserted) {
            showToast('未检测到 Gemini 输入框');
            return;
        }

        closePicker();

        if (shouldSend) {
            await adapter.submitEditor();
            if (typeof GMP.schedulePostSendRender === 'function') {
                GMP.schedulePostSendRender();
            }
        }
    }

    async function handleFilesImport(files) {
        if (!files || !files.length) return;
        const result = await GMP.storage.importFiles(files);
        if (result.added > 0) {
            currentPack = 'custom';
            updateTabBadges();
            renderPickerContent();
            showToast(`已导入 ${result.added} 张表情${result.skipped ? `，跳过 ${result.skipped} 个文件` : ''}`);
        } else {
            showToast('未导入任何有效图片');
        }
    }

    function createCustomActionButtons(meme) {
        const actions = document.createElement('div');
        actions.className = 'gmp-card-actions';

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'gmp-card-action gmp-card-rename';
        renameBtn.title = '重命名';
        renameBtn.setAttribute('aria-label', '重命名');
        renameBtn.textContent = '✎';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingId = meme.id;
            renderPickerContent();
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'gmp-card-action gmp-card-delete';
        delBtn.title = '删除';
        delBtn.setAttribute('aria-label', '删除');
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await GMP.storage.deleteCustomMeme(meme.id);
            updateTabBadges();
            renderPickerContent();
            showToast(`已删除「${meme.name}」`);
        });

        actions.append(renameBtn, delBtn);
        return actions;
    }

    function renderPickerContent() {
        if (!pickerEl) return;
        updateTabBadges();
        syncSettingsMenuUi();

        const filtered = getFilteredList();
        const counterEl = pickerEl.querySelector('.gmp-counter');
        if (counterEl) {
            counterEl.textContent = `共 ${filtered.length} 张`;
        }

        const autoSendCb = pickerEl.querySelector('#gmp-autosend-cb');
        if (autoSendCb) {
            autoSendCb.checked = GMP.storage.getAutoSend();
        }

        const viewport = pickerEl.querySelector('.gmp-grid-viewport');
        if (!viewport) return;
        viewport.replaceChildren();

        if (filtered.length === 0) {
            const emptyBox = document.createElement('div');
            emptyBox.className = 'gmp-empty';

            const emptyText = document.createElement('span');
            emptyText.textContent = searchQuery
                ? '未找到匹配的表情包'
                : currentPack === 'custom'
                    ? '「我的收藏」暂无表情，点击右上角导入或拖入图片'
                    : '暂无默认表情';
            emptyBox.appendChild(emptyText);

            if (!searchQuery && currentPack === 'custom') {
                const quickImportBtn = document.createElement('button');
                quickImportBtn.type = 'button';
                quickImportBtn.className = 'gmp-empty-btn';
                quickImportBtn.textContent = '选择本地图片导入';
                quickImportBtn.addEventListener('click', () => {
                    const fileInput = pickerEl && pickerEl.querySelector('.gmp-file-input');
                    if (fileInput) fileInput.click();
                });
                emptyBox.appendChild(quickImportBtn);
            }

            viewport.appendChild(emptyBox);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'gmp-grid';
        const autoSend = GMP.storage.getAutoSend();

        for (const meme of filtered) {
            const card = document.createElement('div');
            card.className = 'gmp-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.title = autoSend
                ? `${meme.name}（点击直接发送，Shift+点击插入文本框）`
                : `${meme.name}（点击插入文本框，Shift+点击直接发送）`;

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'gmp-card-thumb';

            const img = document.createElement('img');
            img.src = meme.preview;
            img.alt = meme.name;
            img.loading = 'lazy';
            img.decoding = 'async';
            thumbWrap.appendChild(img);
            card.appendChild(thumbWrap);

            if (currentPack === 'custom' && editingId === meme.id) {
                const renameInput = document.createElement('input');
                renameInput.type = 'text';
                renameInput.className = 'gmp-rename-input';
                renameInput.value = meme.name;
                renameInput.addEventListener('click', (e) => e.stopPropagation());
                renameInput.addEventListener('keydown', async (e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        await GMP.storage.renameCustomMeme(meme.id, renameInput.value);
                        editingId = null;
                        renderPickerContent();
                        showToast('已更新名称');
                    } else if (e.key === 'Escape') {
                        editingId = null;
                        renderPickerContent();
                    }
                });
                renameInput.addEventListener('blur', async () => {
                    if (editingId === meme.id) {
                        await GMP.storage.renameCustomMeme(meme.id, renameInput.value);
                        editingId = null;
                        renderPickerContent();
                    }
                });
                card.appendChild(renameInput);
                setTimeout(() => {
                    renameInput.focus();
                    renameInput.select();
                }, 0);
            } else {
                const label = document.createElement('span');
                label.className = 'gmp-card-label';
                label.textContent = meme.name;
                card.appendChild(label);
            }

            if (currentPack === 'custom' && editingId !== meme.id) {
                card.appendChild(createCustomActionButtons(meme));
            }

            card.addEventListener('click', (e) => {
                if (e.target.closest('.gmp-card-actions') || e.target.classList.contains('gmp-rename-input')) {
                    return;
                }
                handleMemeSelect(meme, e.shiftKey);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.classList.contains('gmp-rename-input')) return;
                    e.preventDefault();
                    handleMemeSelect(meme, e.shiftKey);
                }
            });

            grid.appendChild(card);
        }

        viewport.appendChild(grid);
    }

    function openPicker(triggerBtn) {
        if (pickerEl) {
            closePicker();
            return;
        }

        searchQuery = '';
        editingId = null;

        pickerEl = document.createElement('div');
        pickerEl.id = 'gmp-meme-picker';
        pickerEl.setAttribute('role', 'dialog');
        pickerEl.setAttribute('aria-label', 'Gemini 表情包选择器');
        applyThemeAttributes();

        // Top bar
        const topbar = document.createElement('div');
        topbar.className = 'gmp-topbar';

        const searchBox = document.createElement('div');
        searchBox.className = 'gmp-search-box';

        const searchIconWrap = document.createElement('span');
        searchIconWrap.className = 'gmp-search-icon';
        searchIconWrap.appendChild(createSearchSvg());

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'gmp-search-input';
        searchInput.placeholder = '搜索表情描述 / 关键词...';
        searchInput.setAttribute('aria-label', '搜索表情');

        const clearSearchBtn = document.createElement('button');
        clearSearchBtn.type = 'button';
        clearSearchBtn.className = 'gmp-search-clear';
        clearSearchBtn.title = '清空搜索';
        clearSearchBtn.textContent = '✕';
        clearSearchBtn.hidden = true;

        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            clearSearchBtn.hidden = !searchQuery.trim();
            renderPickerContent();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && searchQuery.trim()) {
                const list = getFilteredList();
                if (list.length > 0) {
                    e.preventDefault();
                    handleMemeSelect(list[0], e.shiftKey);
                }
            } else if (e.key === 'Escape' && searchQuery) {
                e.stopPropagation();
                searchQuery = '';
                searchInput.value = '';
                clearSearchBtn.hidden = true;
                renderPickerContent();
            }
        });

        clearSearchBtn.addEventListener('click', () => {
            searchQuery = '';
            searchInput.value = '';
            clearSearchBtn.hidden = true;
            renderPickerContent();
            searchInput.focus();
        });

        searchBox.append(searchIconWrap, searchInput, clearSearchBtn);

        const counter = document.createElement('span');
        counter.className = 'gmp-counter';
        counter.textContent = '共 0 张';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'gmp-file-input';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.hidden = true;
        fileInput.addEventListener('change', async (e) => {
            await handleFilesImport(e.target.files);
            fileInput.value = '';
        });

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'gmp-btn-import';
        importBtn.title = '批量导入本地图片到「我的收藏」';
        importBtn.textContent = '+ 导入';
        importBtn.addEventListener('click', () => fileInput.click());

        settingsBtnEl = document.createElement('button');
        settingsBtnEl.type = 'button';
        settingsBtnEl.className = 'gmp-btn-settings';
        settingsBtnEl.title = '表情大小设置';
        settingsBtnEl.setAttribute('aria-label', '表情大小设置');
        settingsBtnEl.setAttribute('aria-expanded', 'false');
        settingsBtnEl.appendChild(createSettingsSvg());
        settingsBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettingsMenu();
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'gmp-btn-close';
        closeBtn.title = '关闭 (Esc)';
        closeBtn.setAttribute('aria-label', '关闭表情面板');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', closePicker);

        topbar.append(searchBox, counter, fileInput, importBtn, settingsBtnEl, closeBtn);

        settingsMenuEl = buildSettingsMenu();

        // Clicks inside picker outside settings menu close the settings dropdown
        pickerEl.addEventListener('pointerdown', (e) => {
            if (!isSettingsOpen()) return;
            if (
                (settingsMenuEl && settingsMenuEl.contains(e.target)) ||
                (settingsBtnEl && settingsBtnEl.contains(e.target))
            ) {
                return;
            }
            closeSettingsMenu();
        });

        // Viewport + Drag & Drop
        const viewport = document.createElement('div');
        viewport.className = 'gmp-grid-viewport';

        const dropOverlay = document.createElement('div');
        dropOverlay.className = 'gmp-drop-overlay';
        dropOverlay.textContent = '松开鼠标批量导入至「我的收藏」';

        let dragDepth = 0;
        pickerEl.addEventListener('dragenter', (e) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
            dragDepth += 1;
            pickerEl.classList.add('is-dragging');
        });
        pickerEl.addEventListener('dragover', (e) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
        });
        pickerEl.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0 && pickerEl) {
                pickerEl.classList.remove('is-dragging');
            }
        });
        pickerEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragDepth = 0;
            if (pickerEl) pickerEl.classList.remove('is-dragging');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                await handleFilesImport(e.dataTransfer.files);
            }
        });

        // Toast bar
        const toast = document.createElement('div');
        toast.className = 'gmp-toast';

        // Bottom bar
        const bottombar = document.createElement('div');
        bottombar.className = 'gmp-bottombar';

        const tabs = document.createElement('div');
        tabs.className = 'gmp-tabs';

        const defaultTab = document.createElement('button');
        defaultTab.type = 'button';
        defaultTab.className = 'gmp-tab';
        defaultTab.dataset.pack = 'default';
        defaultTab.textContent = '默认';

        const customTab = document.createElement('button');
        customTab.type = 'button';
        customTab.className = 'gmp-tab';
        customTab.dataset.pack = 'custom';
        customTab.textContent = '我的收藏';

        [defaultTab, customTab].forEach((tab) => {
            tab.addEventListener('click', () => {
                currentPack = tab.dataset.pack;
                editingId = null;
                renderPickerContent();
            });
        });

        tabs.append(defaultTab, customTab);

        const autoSendLabel = document.createElement('label');
        autoSendLabel.className = 'gmp-autosend-toggle';
        autoSendLabel.title = '开启：点击直接发送；关闭：插入文本框编辑（Shift+点击可临时切换）';

        const autoSendCb = document.createElement('input');
        autoSendCb.type = 'checkbox';
        autoSendCb.id = 'gmp-autosend-cb';
        autoSendCb.checked = GMP.storage.getAutoSend();
        autoSendCb.addEventListener('change', async (e) => {
            await GMP.storage.setAutoSend(e.target.checked);
            renderPickerContent();
        });

        const autoSendText = document.createElement('span');
        autoSendText.textContent = '点击直接发送';

        autoSendLabel.append(autoSendCb, autoSendText);
        bottombar.append(tabs, autoSendLabel);

        pickerEl.append(topbar, settingsMenuEl, viewport, dropOverlay, toast, bottombar);
        document.body.appendChild(pickerEl);

        if (triggerBtn) {
            triggerBtn.setAttribute('aria-expanded', 'true');
            triggerBtn.classList.add('active');
        }

        renderPickerContent();
        positionPicker(triggerBtn);

        setTimeout(() => {
            if (searchInput.isConnected) searchInput.focus();
        }, 40);
    }

    function mountTriggerButton() {
        const existingBtn = document.getElementById('gmp-trigger-btn');
        if (existingBtn && existingBtn.isConnected) {
            applyThemeAttributes();
            return existingBtn;
        }

        const mountPoint = GMP.adapter && GMP.adapter.findTriggerMountPoint();
        if (!mountPoint || !mountPoint.container) return null;

        const btn = document.createElement('button');
        btn.id = 'gmp-trigger-btn';
        btn.type = 'button';
        btn.className = `gmp-trigger-btn gmp-mount-${mountPoint.mode}`;
        btn.setAttribute('aria-label', '表情包');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('data-theme', GMP.adapter.detectTheme());
        btn.title = '表情包 (Gemini Meme Picker)';
        btn.appendChild(createSmileSvg());

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPicker(btn);
        });

        if (mountPoint.beforeEl && mountPoint.beforeEl.parentElement === mountPoint.container) {
            mountPoint.container.insertBefore(btn, mountPoint.beforeEl);
        } else {
            mountPoint.container.appendChild(btn);
        }

        return btn;
    }

    function isOpen() {
        return Boolean(pickerEl && pickerEl.isConnected);
    }

    function refresh() {
        applyThemeAttributes();
        if (isOpen()) {
            renderPickerContent();
            positionPicker(document.getElementById('gmp-trigger-btn'));
        }
    }

    GMP.picker = {
        mountTriggerButton,
        openPicker,
        closePicker,
        closeSettingsMenu,
        isSettingsOpen,
        positionPicker,
        renderPickerContent,
        applyThemeAttributes,
        isOpen,
        refresh
    };
})();

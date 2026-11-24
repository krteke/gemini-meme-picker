import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function loadModuleIntoVm(relPath, extraGlobals = {}) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    const context = {
        console,
        setTimeout,
        clearTimeout,
        URL,
        ...extraGlobals
    };
    context.globalThis = context;
    context.window = context;
    vm.createContext(context);
    vm.runInContext(code, context, { filename: relPath });
    return context;
}

test('Manifest V3 configuration and referenced files are valid', () => {
    const manifestPath = path.join(ROOT_DIR, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.permissions.includes('unlimitedStorage'));

    for (const iconPath of Object.values(manifest.icons)) {
        assert.ok(fs.existsSync(path.join(ROOT_DIR, iconPath)), `Missing icon: ${iconPath}`);
    }

    assert.ok(fs.existsSync(path.join(ROOT_DIR, manifest.action.default_popup)), 'Missing popup HTML');

    assert.equal(manifest.content_scripts.length, 1);
    const cs = manifest.content_scripts[0];
    assert.deepEqual(cs.matches, ['https://gemini.google.com/*']);

    for (const file of [...cs.css, ...cs.js]) {
        assert.ok(fs.existsSync(path.join(ROOT_DIR, file)), `Missing content script file: ${file}`);
    }

    assert.ok(
        manifest.web_accessible_resources.some((r) => r.resources.includes('assets/presets/*')),
        'web_accessible_resources should expose assets/presets/*'
    );
});

test('All 23 preset WebP stickers and manifest entries exist and are valid WebP files', () => {
    const presetsManifestPath = path.join(ROOT_DIR, 'assets', 'presets', 'manifest.json');
    const presets = JSON.parse(fs.readFileSync(presetsManifestPath, 'utf8'));

    assert.equal(presets.length, 23);

    for (const item of presets) {
        assert.ok(item.id);
        assert.ok(item.name);
        assert.equal(item.tag, `[表情: ${item.name}]`);
        assert.ok(Array.isArray(item.keywords) && item.keywords.length > 0, `Missing keywords for ${item.name}`);

        const filePath = path.join(ROOT_DIR, item.path);
        assert.ok(fs.existsSync(filePath), `Missing preset file: ${item.path}`);
        const buf = fs.readFileSync(filePath);
        assert.ok(buf.length > 100, `Preset file too small: ${item.path}`);
        assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid RIFF header: ${item.path}`);
        assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WEBP signature: ${item.path}`);
    }
});

test('Trusted Types compliance & no Python/desktop injection files', () => {
    const forbiddenExts = ['.py', '.bat', '.ps1'];
    const entries = fs.readdirSync(ROOT_DIR);
    for (const entry of entries) {
        assert.ok(!forbiddenExts.includes(path.extname(entry).toLowerCase()), `Forbidden file in root: ${entry}`);
    }

    const jsDirs = ['src', 'popup'];
    for (const dir of jsDirs) {
        const dirPath = path.join(ROOT_DIR, dir);
        for (const file of fs.readdirSync(dirPath)) {
            if (!file.endsWith('.js')) continue;
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
            assert.equal(/\.\s*(innerHTML|outerHTML)\s*=/.test(content), false, `${dir}/${file} assigns innerHTML/outerHTML`);
            assert.equal(/insertAdjacentHTML\s*\(/.test(content), false, `${dir}/${file} calls insertAdjacentHTML`);
        }
    }
});

test('storage.filterMemes supports Chinese names, keywords, case-insensitivity, and multi-token search', () => {
    const ctx = loadModuleIntoVm('src/storage.js');
    const presets = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'assets', 'presets', 'manifest.json'), 'utf8'));
    const { filterMemes, sanitizeName } = ctx.__GMP.storage;

    assert.equal(filterMemes(presets, '').length, 23);
    assert.deepEqual(
        filterMemes(presets, '哈气').map((m) => m.name),
        ['哈气']
    );
    assert.deepEqual(
        filterMemes(presets, 'MOYU').map((m) => m.name),
        ['摸鱼']
    );
    assert.deepEqual(
        filterMemes(presets, '小鱼干 投喂').map((m) => m.name),
        ['饿饿']
    );
    assert.equal(sanitizeName('01-超开心[测试].png'), '01-超开心测试');
    assert.equal(sanitizeName('   .webp'), 'sticker');
});

test('renderer.classifyTextBlock and isAssistantStickerAlt handle all bubble modes accurately', () => {
    const ctx = loadModuleIntoVm('src/renderer.js');
    const { buildMemeLookup, classifyTextBlock, isAssistantStickerAlt } = ctx.__GMP.renderer;

    const presets = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'assets', 'presets', 'manifest.json'), 'utf8'));
    const withPreview = presets.map((p) => ({ ...p, preview: `chrome-extension://test/${p.path}` }));
    const { memeMap, memeNames } = buildMemeLookup(withPreview, []);

    const toPlain = (val) => JSON.parse(JSON.stringify(val));

    // Single standalone -> default 140px
    assert.deepEqual(toPlain(classifyTextBlock('[表情: 开心]', memeMap)), {
        kind: 'standalone',
        names: ['开心'],
        size: 140
    });

    // Full-width colon supported
    assert.deepEqual(toPlain(classifyTextBlock('  [表情：哈气]  ', memeMap)), {
        kind: 'standalone',
        names: ['哈气'],
        size: 140
    });

    // Multiple standalone -> 112px horizontal (80% of 140)
    assert.deepEqual(toPlain(classifyTextBlock('[表情: 开心] [表情: 点赞] [表情: 好耶]', memeMap)), {
        kind: 'standalone',
        names: ['开心', '点赞', '好耶'],
        size: 112
    });

    // Mixed text + sticker -> default 72px inline
    assert.deepEqual(toPlain(classifyTextBlock('今天效率好高 [表情: 点赞] 继续加油！', memeMap)), {
        kind: 'inline',
        names: ['点赞'],
        size: 72
    });

    // Custom size settings override
    assert.deepEqual(
        toPlain(classifyTextBlock('[表情: 开心]', memeMap, { standalone: 200, inline: 96, assistantMax: 220 })),
        {
            kind: 'standalone',
            names: ['开心'],
            size: 200
        }
    );
    assert.deepEqual(
        toPlain(classifyTextBlock('你好 [表情: 开心]', memeMap, { standalone: 200, inline: 96, assistantMax: 220 })),
        {
            kind: 'inline',
            names: ['开心'],
            size: 96
        }
    );

    // Unknown tag alone -> none
    assert.deepEqual(toPlain(classifyTextBlock('[表情: 不存在的贴纸]', memeMap)), {
        kind: 'none',
        names: [],
        size: 0
    });

    // Mixed known + unknown -> inline (only known rendered)
    assert.deepEqual(toPlain(classifyTextBlock('[表情: 开心] [表情: 未知]', memeMap)), {
        kind: 'inline',
        names: ['开心'],
        size: 72
    });

    // Assistant media alt recognition
    assert.equal(isAssistantStickerAlt('开心', memeNames), true);
    assert.equal(isAssistantStickerAlt('表情: 哈气', memeNames), true);
    assert.equal(isAssistantStickerAlt('meme: happy cat', memeNames), true);
    assert.equal(isAssistantStickerAlt('sticker：yay', memeNames), true);
    assert.equal(isAssistantStickerAlt('System architecture diagram', memeNames), false);
    assert.equal(isAssistantStickerAlt('', memeNames), false);
});

test('storage.normalizeSizeSettings clamps bounds and computes multi size', () => {
    const ctx = loadModuleIntoVm('src/storage.js');
    const { normalizeSizeSettings, DEFAULT_SIZE_SETTINGS } = ctx.__GMP.storage;
    const toPlain = (val) => JSON.parse(JSON.stringify(val));

    assert.deepEqual(toPlain(normalizeSizeSettings(null)), {
        standalone: DEFAULT_SIZE_SETTINGS.standalone,
        multi: 112,
        inline: DEFAULT_SIZE_SETTINGS.inline,
        assistantMax: DEFAULT_SIZE_SETTINGS.assistantMax
    });

    assert.deepEqual(toPlain(normalizeSizeSettings({ standalone: 999, inline: 10, assistantMax: 50 })), {
        standalone: 240,
        multi: 192,
        inline: 40,
        assistantMax: 100
    });
});

test('renderer.getVisibleText ignores visually-hidden accessibility nodes (e.g. cdk-visually-hidden)', () => {
    const ctx = loadModuleIntoVm('src/renderer.js');
    const { getVisibleText, buildMemeLookup, classifyTextBlock } = ctx.__GMP.renderer;
    const toPlain = (val) => JSON.parse(JSON.stringify(val));

    const presets = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'assets', 'presets', 'manifest.json'), 'utf8'));
    const withPreview = presets.map((p) => ({ ...p, preview: `chrome-extension://test/${p.path}` }));
    const { memeMap } = buildMemeLookup(withPreview, []);

    const mockQueryText = {
        nodeType: 1,
        tagName: 'DIV',
        className: 'query-text',
        getAttribute: () => null,
        childNodes: [
            {
                nodeType: 1,
                tagName: 'SPAN',
                className: 'cdk-visually-hidden',
                getAttribute: () => null,
                childNodes: [{ nodeType: 3, nodeValue: '你说 ' }]
            },
            {
                nodeType: 1,
                tagName: 'P',
                className: 'query-text-line',
                getAttribute: () => null,
                childNodes: [{ nodeType: 3, nodeValue: '[表情: 开心]' }]
            }
        ]
    };

    const visible = getVisibleText(mockQueryText);
    assert.equal(visible, '[表情: 开心]');
    assert.deepEqual(toPlain(classifyTextBlock(visible, memeMap)), {
        kind: 'standalone',
        names: ['开心'],
        size: 140
    });
});

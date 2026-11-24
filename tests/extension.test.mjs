import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIREFOX_META } from '../scripts/firefox-meta.mjs';
import { buildUpdatesManifest, computeSha512Hash } from '../scripts/generate-updates-json.mjs';
import {
    DEFAULT_SIZE_SETTINGS,
    filterMemes,
    normalizeSizeSettings,
    sanitizeName
} from '../src/lib/storage.js';
import {
    buildMemeLookup,
    classifyTextBlock,
    getVisibleText,
    isAssistantStickerAlt
} from '../src/lib/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PRESETS_MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'assets', 'presets', 'manifest.json');

test('All 23 preset WebP stickers and manifest entries exist and are valid WebP files', () => {
    const presets = JSON.parse(fs.readFileSync(PRESETS_MANIFEST_PATH, 'utf8'));
    assert.equal(presets.length, 23);

    for (const item of presets) {
        assert.ok(item.id);
        assert.ok(item.name);
        assert.equal(item.tag, `[表情: ${item.name}]`);
        assert.ok(Array.isArray(item.keywords) && item.keywords.length > 0, `Missing keywords for ${item.name}`);

        const filePath = path.join(ROOT_DIR, 'public', item.path);
        assert.ok(fs.existsSync(filePath), `Missing preset file: public/${item.path}`);
        const buf = fs.readFileSync(filePath);
        assert.ok(buf.length > 100, `Preset file too small: ${item.path}`);
        assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `Invalid RIFF header: ${item.path}`);
        assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `Invalid WEBP signature: ${item.path}`);
    }
});

test('Trusted Types compliance & no Python/desktop injection files', () => {
    const forbiddenExts = ['.py', '.bat', '.ps1'];
    for (const entry of fs.readdirSync(ROOT_DIR)) {
        assert.ok(!forbiddenExts.includes(path.extname(entry).toLowerCase()), `Forbidden file in root: ${entry}`);
    }

    const scanTargets = [
        path.join(ROOT_DIR, 'src', 'lib'),
        path.join(ROOT_DIR, 'entrypoints'),
        path.join(ROOT_DIR, 'entrypoints', 'popup')
    ];

    for (const dirPath of scanTargets) {
        for (const entry of fs.readdirSync(dirPath)) {
            if (!entry.endsWith('.js') && !entry.endsWith('.ts')) continue;
            const filePath = path.join(dirPath, entry);
            const content = fs.readFileSync(filePath, 'utf8');
            assert.equal(
                /\.\s*(innerHTML|outerHTML)\s*=/.test(content),
                false,
                `${path.relative(ROOT_DIR, filePath)} assigns innerHTML/outerHTML`
            );
            assert.equal(
                /insertAdjacentHTML\s*\(/.test(content),
                false,
                `${path.relative(ROOT_DIR, filePath)} calls insertAdjacentHTML`
            );
        }
    }
});

test('storage.filterMemes and normalizeSizeSettings work accurately', () => {
    const presets = JSON.parse(fs.readFileSync(PRESETS_MANIFEST_PATH, 'utf8'));

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

    assert.deepEqual(normalizeSizeSettings(null), {
        standalone: DEFAULT_SIZE_SETTINGS.standalone,
        multi: 112,
        inline: DEFAULT_SIZE_SETTINGS.inline,
        assistantMax: DEFAULT_SIZE_SETTINGS.assistantMax
    });

    assert.deepEqual(normalizeSizeSettings({ standalone: 999, inline: 10, assistantMax: 50 }), {
        standalone: 240,
        multi: 192,
        inline: 40,
        assistantMax: 100
    });
});

test('renderer.classifyTextBlock, getVisibleText, and isAssistantStickerAlt handle all bubble modes', () => {
    const presets = JSON.parse(fs.readFileSync(PRESETS_MANIFEST_PATH, 'utf8'));
    const withPreview = presets.map((p) => ({ ...p, preview: `moz-extension://test/${p.path}` }));
    const { memeMap, memeNames } = buildMemeLookup(withPreview, []);

    assert.deepEqual(classifyTextBlock('[表情: 开心]', memeMap), {
        kind: 'standalone',
        names: ['开心'],
        size: 140
    });
    assert.deepEqual(classifyTextBlock('  [表情：哈气]  ', memeMap), {
        kind: 'standalone',
        names: ['哈气'],
        size: 140
    });
    assert.deepEqual(classifyTextBlock('[表情: 开心] [表情: 点赞] [表情: 好耶]', memeMap), {
        kind: 'standalone',
        names: ['开心', '点赞', '好耶'],
        size: 112
    });
    assert.deepEqual(classifyTextBlock('今天效率好高 [表情: 点赞] 继续加油！', memeMap), {
        kind: 'inline',
        names: ['点赞'],
        size: 72
    });
    assert.deepEqual(
        classifyTextBlock('[表情: 开心]', memeMap, { standalone: 200, inline: 96, assistantMax: 220 }),
        {
            kind: 'standalone',
            names: ['开心'],
            size: 200
        }
    );
    assert.deepEqual(classifyTextBlock('[表情: 不存在的贴纸]', memeMap), {
        kind: 'none',
        names: [],
        size: 0
    });
    assert.deepEqual(classifyTextBlock('[表情: 开心] [表情: 未知]', memeMap), {
        kind: 'inline',
        names: ['开心'],
        size: 72
    });

    assert.equal(isAssistantStickerAlt('开心', memeNames), true);
    assert.equal(isAssistantStickerAlt('表情: 哈气', memeNames), true);
    assert.equal(isAssistantStickerAlt('meme: happy cat', memeNames), true);
    assert.equal(isAssistantStickerAlt('sticker：yay', memeNames), true);
    assert.equal(isAssistantStickerAlt('System architecture diagram', memeNames), false);

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
    assert.deepEqual(classifyTextBlock(visible, memeMap), {
        kind: 'standalone',
        names: ['开心'],
        size: 140
    });
});

test('WXT built Chrome MV3 and Firefox MV2 outputs are valid', () => {
    const chromeDir = path.join(ROOT_DIR, '.output', 'chrome-mv3');
    const firefoxDir = path.join(ROOT_DIR, '.output', 'firefox-mv2');

    assert.ok(fs.existsSync(path.join(chromeDir, 'manifest.json')), 'Missing .output/chrome-mv3/manifest.json (run pnpm build:all)');
    assert.ok(fs.existsSync(path.join(firefoxDir, 'manifest.json')), 'Missing .output/firefox-mv2/manifest.json (run pnpm build:all)');

    const chromeManifest = JSON.parse(fs.readFileSync(path.join(chromeDir, 'manifest.json'), 'utf8'));
    assert.equal(chromeManifest.manifest_version, 3);
    assert.ok(chromeManifest.permissions.includes('storage'));
    assert.ok(chromeManifest.permissions.includes('unlimitedStorage'));
    assert.ok(chromeManifest.action?.default_popup);
    assert.ok(fs.existsSync(path.join(chromeDir, chromeManifest.action.default_popup)));
    assert.ok(chromeManifest.content_scripts.some((cs) => cs.matches.includes('https://gemini.google.com/*')));
    assert.ok(
        chromeManifest.web_accessible_resources.some(
            (r) => Array.isArray(r.resources) && r.resources.includes('assets/presets/*')
        )
    );
    assert.ok(fs.existsSync(path.join(chromeDir, 'assets', 'presets', 'default', '01-开心.webp')));

    const firefoxManifest = JSON.parse(fs.readFileSync(path.join(firefoxDir, 'manifest.json'), 'utf8'));
    assert.equal(firefoxManifest.manifest_version, 2);
    assert.equal(firefoxManifest.browser_specific_settings?.gecko?.id, FIREFOX_META.addonId);
    assert.equal(firefoxManifest.browser_specific_settings?.gecko?.update_url, FIREFOX_META.updateUrl);
    assert.ok(firefoxManifest.browser_specific_settings?.gecko?.update_url.startsWith('https://'));
    assert.ok(firefoxManifest.permissions.includes('storage'));
    assert.ok(firefoxManifest.permissions.includes('unlimitedStorage'));
    assert.ok(firefoxManifest.browser_action?.default_popup);
    assert.ok(fs.existsSync(path.join(firefoxDir, firefoxManifest.browser_action.default_popup)));
    assert.ok(firefoxManifest.content_scripts.some((cs) => cs.matches.includes('https://gemini.google.com/*')));
    assert.ok(
        Array.isArray(firefoxManifest.web_accessible_resources) &&
            firefoxManifest.web_accessible_resources.includes('assets/presets/*')
    );
    assert.ok(fs.existsSync(path.join(firefoxDir, 'assets', 'presets', 'default', '01-开心.webp')));
});

test('Firefox updates.json, generator script, and GitHub Actions release workflow are valid', () => {
    const updatesPath = path.join(ROOT_DIR, 'updates.json');
    assert.ok(fs.existsSync(updatesPath), 'Missing updates.json');
    const updatesJson = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
    assert.ok(Array.isArray(updatesJson.addons?.[FIREFOX_META.addonId]?.updates));

    const tmpFile = path.join(os.tmpdir(), `gmp-test-${Date.now()}.xpi`);
    fs.writeFileSync(tmpFile, 'dummy-xpi-content', 'utf8');
    try {
        const hash = computeSha512Hash(tmpFile);
        assert.match(hash, /^sha512:[a-f0-9]{128}$/);

        const v1 = buildUpdatesManifest({
            existingManifest: updatesJson,
            addonId: FIREFOX_META.addonId,
            version: '1.0.0',
            updateLink: 'https://github.com/krteke/gemini-meme-picker/releases/download/v1.0.0/ext.xpi',
            updateHash: hash
        });
        assert.equal(v1.addons[FIREFOX_META.addonId].updates.length, 1);
        assert.equal(v1.addons[FIREFOX_META.addonId].updates[0].applications.gecko.strict_min_version, '109.0');

        const v2 = buildUpdatesManifest({
            existingManifest: v1,
            addonId: FIREFOX_META.addonId,
            version: '1.0.1',
            updateLink: 'https://github.com/krteke/gemini-meme-picker/releases/download/v1.0.1/ext.xpi',
            updateHash: hash
        });
        assert.equal(v2.addons[FIREFOX_META.addonId].updates.length, 2);

        const v2Dup = buildUpdatesManifest({
            existingManifest: v2,
            addonId: FIREFOX_META.addonId,
            version: '1.0.1',
            updateLink: 'https://github.com/krteke/gemini-meme-picker/releases/download/v1.0.1/ext-new.xpi',
            updateHash: hash
        });
        assert.equal(v2Dup.addons[FIREFOX_META.addonId].updates.length, 2);
        assert.equal(
            v2Dup.addons[FIREFOX_META.addonId].updates[1].update_link,
            'https://github.com/krteke/gemini-meme-picker/releases/download/v1.0.1/ext-new.xpi'
        );
    } finally {
        fs.rmSync(tmpFile, { force: true });
    }

    const workflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'release.yml');
    assert.ok(fs.existsSync(workflowPath), 'Missing .github/workflows/release.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(workflow.includes('pnpm zip'));
    assert.ok(workflow.includes('-chrome.zip'));
    assert.ok(workflow.includes('web-ext sign'));
    assert.ok(workflow.includes('--channel=unlisted'));
    assert.ok(workflow.includes('AMO_JWT_ISSUER'));
    assert.ok(workflow.includes('AMO_JWT_SECRET'));
    assert.ok(workflow.includes('updates.json'));
});

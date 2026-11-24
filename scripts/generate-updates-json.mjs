import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FIREFOX_META } from './firefox-meta.mjs';

export function computeSha512Hash(filePath) {
    const data = fs.readFileSync(filePath);
    const hex = crypto.createHash('sha512').update(data).digest('hex');
    return `sha512:${hex}`;
}

export function buildUpdatesManifest({
    existingManifest,
    addonId = FIREFOX_META.addonId,
    version,
    updateLink,
    updateHash,
    strictMinVersion = FIREFOX_META.strictMinVersion
}) {
    if (!addonId) throw new Error('addonId is required');
    if (!version) throw new Error('version is required');
    if (!updateLink) throw new Error('updateLink is required');
    if (!updateHash || !String(updateHash).startsWith('sha512:')) {
        throw new Error('updateHash with sha512: prefix is required');
    }

    const baseAddons =
        existingManifest &&
        typeof existingManifest === 'object' &&
        existingManifest.addons &&
        typeof existingManifest.addons === 'object'
            ? { ...existingManifest.addons }
            : {};

    const currentEntry =
        baseAddons[addonId] && Array.isArray(baseAddons[addonId].updates)
            ? baseAddons[addonId].updates
            : [];

    const filtered = currentEntry.filter((item) => item && item.version !== version);
    const nextEntry = {
        version,
        update_link: updateLink,
        update_hash: updateHash,
        applications: {
            gecko: {
                strict_min_version: strictMinVersion
            }
        }
    };

    return {
        addons: {
            ...baseAddons,
            [addonId]: {
                updates: [...filtered, nextEntry]
            }
        }
    };
}

function parseCliArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            args[key] = next;
            i += 1;
        } else {
            args[key] = 'true';
        }
    }
    return args;
}

function runCli() {
    const args = parseCliArgs(process.argv.slice(2));
    const version = String(args.version || '').replace(/^v/, '').trim();
    const tag = String(args.tag || (version ? `v${version}` : '')).trim();
    const xpiPath = args.xpi ? path.resolve(args.xpi) : '';
    const outputPath = path.resolve(args.output || 'updates.json');
    const repo = args.repo || `${FIREFOX_META.repoOwner}/${FIREFOX_META.repoName}`;
    const addonId = args['addon-id'] || FIREFOX_META.addonId;

    if (!version || !tag || !xpiPath) {
        throw new Error(
            'Usage: node scripts/generate-updates-json.mjs --version <ver> --tag <tag> --xpi <path> [--output updates.json] [--repo owner/name]'
        );
    }
    if (!fs.existsSync(xpiPath)) {
        throw new Error(`Signed XPI not found: ${xpiPath}`);
    }

    let existingManifest = null;
    if (fs.existsSync(outputPath)) {
        try {
            existingManifest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        } catch (err) {
            console.warn(`[generate-updates-json] Failed to parse existing ${outputPath}, recreating: ${err.message}`);
        }
    }

    const xpiFilename = path.basename(xpiPath);
    const updateLink =
        args['update-link'] ||
        `https://github.com/${repo}/releases/download/${tag}/${xpiFilename}`;
    const updateHash = computeSha512Hash(xpiPath);

    const nextManifest = buildUpdatesManifest({
        existingManifest,
        addonId,
        version,
        updateLink,
        updateHash,
        strictMinVersion: FIREFOX_META.strictMinVersion
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(nextManifest, null, 2) + '\n', 'utf8');
    console.log(`[generate-updates-json] Updated ${path.relative(process.cwd(), outputPath)} for ${addonId} v${version}`);
}

const isDirectRun =
    process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
    runCli();
}

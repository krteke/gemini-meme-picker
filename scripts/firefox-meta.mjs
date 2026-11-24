export const FIREFOX_META = Object.freeze({
    addonId: process.env.FIREFOX_ADDON_ID || 'gemini-meme-picker@krteke.github.io',
    strictMinVersion: '109.0',
    repoOwner: 'krteke',
    repoName: 'gemini-meme-picker',
    updateUrl:
        process.env.FIREFOX_UPDATE_URL ||
        'https://raw.githubusercontent.com/krteke/gemini-meme-picker/main/updates.json'
});

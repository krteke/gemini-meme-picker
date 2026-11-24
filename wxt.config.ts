import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser, manifestVersion }) => {
    const webAccessibleResources =
      manifestVersion === 2
        ? ['assets/presets/*']
        : [
            {
              resources: ['assets/presets/*'],
              matches: ['https://gemini.google.com/*'],
            },
          ];

    const baseManifest = {
      name: 'Gemini Meme Picker',
      description: '为 Google Gemini 网页端打造的原生聊天表情包抽屉与自定义图库扩展。',
      permissions: ['storage', 'unlimitedStorage'],
      icons: {
        16: 'icon/16.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
      web_accessible_resources: webAccessibleResources,
    };

    if (browser === 'firefox') {
      return {
        ...baseManifest,
        browser_specific_settings: {
          gecko: {
            id: 'gemini-meme-picker@gemini-meme-picker.dev',
            strict_min_version: '109.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      };
    }

    return baseManifest;
  },
});

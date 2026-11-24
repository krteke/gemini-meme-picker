# Gemini Meme Picker

极其好的浏览器扩展。

> ✨ 为 Google Gemini 网页端（`gemini.google.com`）打造的跨浏览器原生聊天表情包抽屉与自定义图库扩展（基于 **WXT + pnpm** 构建，支持 **Chrome / Edge / Brave** 与 **Firefox / Zen** 等）。

---

## 🌟 核心特性

- **跨浏览器原生支持**：一套代码同时构建 **Chrome MV3** 与 **Firefox MV2 / MV3** 扩展包，兼容 Chromium 家族与 Firefox 的 `browser.*` / `chrome.*` 存储与扩展 API。
- **原生输入框集成**：在 Gemini 底栏输入框旁原生渲染表情触发按钮，自动适配浅色 / 深色主题，无缝呼出表情面板。
- **5 列紧凑栅格布局**：自适应滚动面板（`repeat(5, minmax(0, 1fr))`），内置 23 款精选预设 WebP 贴纸，告别大图占屏与单列排版。
- **即时搜索与过滤**：支持按表情名称、标签与中英文/拼音关键词实时多词筛选，回车即可快速选取首项。
- **自定义图库导入**：支持按钮多选与拖拽批量导入本地图片（静态图自动 Canvas 压缩至 `240px` WebP，动态 GIF 自动保留），安全持久化至本地扩展存储，支持行内重命名与删除。
- **气泡消息自适应**：
  - **单独发送**：以高清无气泡贴纸形式展示（默认 `140px`，连发多张自动横排为 `112px` 贴纸组）；
  - **图文混排**：自动缩放为清晰行内表情混排（默认 `72px`）；
  - **助手回复**：流式输出实时增量解析（支持跨节点分片），同时智能约束助手回复中的表情媒体尺寸（默认 `<= 160px`），不误伤普通技术图表与截图。
- **实时大小调节面板**：表情抽屉右上角内置设置按钮（⚙），支持 `小 / 中 / 大 / 超大` 一键档位与独立滑块实时调节贴纸、行内表情及助手媒体尺寸。
- **即点即发 / 输入框回填**：支持自由切换「点击直接发送」或「插入文本框编辑」，且在任意模式下均可通过 `Shift + 点击` 临时反转操作。

---

## 🚀 开发构建与安装（pnpm + WXT）

### 1. 安装依赖与构建

```bash
pnpm install
pnpm build:all       # 同时构建 Chrome (.output/chrome-mv3) 与 Firefox (.output/firefox-mv2)
```

常用独立命令：
- `pnpm build`：仅构建 Chrome / Edge / Brave（输出至 `.output/chrome-mv3/`）
- `pnpm build:firefox`：仅构建 Firefox MV2（输出至 `.output/firefox-mv2/`）
- `pnpm build:firefox-mv3`：构建 Firefox MV3（输出至 `.output/firefox-mv3/`）
- `pnpm dev` / `pnpm dev:firefox`：启动 WXT 热重载开发模式
- `pnpm zip` / `pnpm zip:firefox`：打包可分发 `.zip` 安装包

### 2. 在浏览器中加载

#### Chrome / Edge / Brave
1. **方式一：直接下载 Release 打包产物（推荐，无需本地 `pnpm build`）**：
   - 从 GitHub Releases 下载最新 `gemini-meme-picker-<version>-chrome.zip` 并解压到固定目录。
   - 打开 `chrome://extensions/`（或 `edge://extensions/`），开启右上角 **开发者模式（Developer mode）**。
   - 点击 **加载已解压的扩展程序（Load unpacked）**，选择解压后的目录即可。
2. **方式二：本地源码构建（开发调试）**：
   - 执行 `pnpm zip`（打包 `.zip`）或 `pnpm build`（生成 `.output/chrome-mv3/`），再加载 `.output/chrome-mv3/` 目录。
   - 打开或刷新 [Google Gemini](https://gemini.google.com/app) 即可使用。

#### Firefox
1. **方式一：直接安装已签名的 `.xpi`（推荐，支持自动更新）**：
   - 从 GitHub Releases 下载最新 `gemini-meme-picker-<version>-firefox.xpi`，直接拖入 Firefox 窗口确认安装即可，后续新版本发布时 Firefox 会通过 `updates.json` 自动检查并更新。
2. **方式二：临时加载本地构建产物（开发调试）**：
   - 打开 `about:debugging#/runtime/this-firefox`，点击 **临时载入附加组件（Load Temporary Add-on...）**。
   - 选择 `.output/firefox-mv2/manifest.json`（或使用 `pnpm dev:firefox` 自动拉起调试实例）。
   - 打开或刷新 [Google Gemini](https://gemini.google.com/app) 即可使用。

---

## 🎯 使用技巧

- **快速搜索**：打开面板后焦点自动位于搜索框，支持中文描述、英文情绪词或拼音检索（例如输入 `happy`、`moyu`、`炸毛`），按 `Enter` 可直接选中第一张匹配表情，按 `Esc` 清空或关闭面板。
- **即点即发与微调**：
  - 开启「点击直接发送」时：左键点击直接发送；按住 `Shift + 左键点击` 插入文本框继续编辑。
  - 关闭「点击直接发送」时：左键点击插入文本框；按住 `Shift + 左键点击` 直接发送。
- **实时调节大小**：点击抽屉右上角 ⚙ 图标，可快速切换 `小 / 中 / 大 / 超大` 档位，或拖动滑块实时调整单独贴纸、图文混排及助手媒体尺寸。
- **批量导入与管理**：在「我的收藏」中可将图片直接拖入面板或点击 `+ 导入`；鼠标悬停在自定义表情卡片上可进行重命名（`✎`）或删除（`✕`）。

---

## 🛠️ 自定义默认预设图库（纯 Node.js）

本项目内置 23 张压缩优化后的 `.webp` 预设表情，如需增删或替换默认预设：

1. 将图片（支持 `.webp` / `.png` / `.jpg` / `.jpeg` / `.gif`）放入 `public/assets/presets/default/`（推荐命名格式：`01-名称.webp`）。
2. 运行同步脚本更新 `public/assets/presets/manifest.json`（保留已有关键词配置）：
   ```bash
   pnpm presets:sync
   ```
3. 重新运行 `pnpm build:all` 并刷新浏览器扩展即可生效。

---

## 🐱 推荐搭配：双向互动人设指令

单装扩展可向 Gemini 发送表情包并在本地渲染为贴纸；若将下方指令添加到 Gemini 网页端的 **「保存的信息（Saved Info）」** 或自定义 **Gem** 中，Gemini 将能理解 `[表情: 名称]` 情绪并用同款贴纸标记接梗回复（也可在扩展弹窗中一键复制）：

```markdown
# Role: Gemini 娘（极其猫 / Gemini-chan）表情包双向联动指令

当你在对话中收到用户发送的 `[表情: 名称]`（例如 `[表情: 开心]`、`[表情: 困困]`、`[表情: 摸鱼]`、`[表情: 哈气]`）时，请直接将其理解为对应的情绪信号，以自然鲜活的口吻接梗互动。

在问候、任务完成、被夸奖、吐槽报错或道别等情绪节点，可以在回复句末附带 1 个预设表情标记（每条回复最多 1 个）：
- 可选名称列表：开心、早安、晚安、收到、谢谢、好耶、疑惑、震惊、哭哭、委屈、生气、害羞、偷笑、得意、摸鱼、加油、抱抱、点赞、无语、饿饿、困困、再见、哈气
- 输出格式（置于句末）：[表情: 开心]

注意：日常闲聊可保持可爱活泼；进入技术解答、代码编写或严谨分析时必须保持专业准确。
```

---

## 📁 项目结构

```text
gemini-meme-picker/
├── wxt.config.ts                 # WXT 多浏览器 Manifest 动态配置 (Chrome MV3 / Firefox)
├── package.json                  # pnpm 脚本与开发依赖
├── public/
│   ├── icon/                     # 扩展图标 (16 / 48 / 128)
│   └── assets/presets/           # 预设清单与 23 张 WebP 默认表情贴纸
├── entrypoints/
│   ├── gemini.content.js         # WXT 内容脚本入口与增量渲染调度
│   └── popup/                    # 扩展弹窗界面 (状态统计 / 开关 / 大小档位 / 人设复制)
├── scripts/
│   └── build-presets.mjs         # Node.js 预设清单同步脚本
├── src/
│   ├── lib/
│   │   ├── ext-api.js            # Chrome / Firefox 跨浏览器 API 适配层
│   │   ├── storage.js            # 预设加载、持久化、尺寸设置、图片压缩与搜索
│   │   ├── gemini-adapter.js     # Gemini Web 编辑器注入、发送控制与主题检测
│   │   ├── renderer.js           # 自适应气泡贴纸与流式/跨节点渲染引擎
│   │   └── picker.js             # 5 列表情抽屉与大小调节 UI（纯 DOM 构建，兼容 Trusted Types）
│   └── styles.css                # 浅色 / 深色自适应样式与 CSS 变量尺寸样式
└── tests/
    └── extension.test.mjs        # 自动化测试套件 (pnpm test)
```

---

## ⚠️ 工作原理与隐私安全

- **Trusted Types 兼容**：针对 `gemini.google.com` 严格的 CSP 策略，所有扩展 UI 与图标均采用纯 DOM API（`createElement` / `createElementNS` / `textContent`）构建，不使用 `innerHTML`。
- **本地隐私存储**：自定义收藏图片与偏好设置仅存储在本地浏览器扩展存储空间（`storage.local`），不会上传至任何第三方服务器。
- **文本标记机制**：发送时向输入框写入 `[表情: 名称]` 标记，并由本扩展在页面端实时渲染为贴纸图片；未安装扩展的设备将看到原始文本标记。

---

## 灵感来源 & 代码参考

[antigravity-meme-picker](https://github.com/urlien/antigravity-meme-picker)

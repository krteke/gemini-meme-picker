# Gemini Meme Picker

> ✨ 为 Google Gemini 网页端（`gemini.google.com`）打造的原生聊天表情包抽屉与自定义图库浏览器扩展（Manifest V3）。

---

## 🌟 核心特性

- **原生输入框集成**：在 Gemini 底栏输入框旁原生渲染表情触发按钮，自动适配浅色 / 深色主题，无缝呼出表情面板。
- **5 列紧凑栅格布局**：自适应滚动面板（`repeat(5, minmax(0, 1fr))`），内置 23 款精选预设 WebP 贴纸，告别大图占屏与单列排版。
- **即时搜索与过滤**：支持按表情名称、标签与中英文/拼音关键词实时多词筛选，回车即可快速选取首项。
- **自定义图库导入**：支持按钮多选与拖拽批量导入本地图片（静态图自动 Canvas 压缩至 `200px` WebP，动态 GIF 自动保留），安全持久化至本地 `chrome.storage.local`，支持行内重命名与删除。
- **气泡消息自适应**：
  - **单独发送**：以高清无气泡贴纸形式展示（默认 `140px`，连发多张自动横排为 `112px` 贴纸组）；
  - **图文混排**：自动缩放为清晰行内表情混排（默认 `72px`）；
  - **助手回复**：流式输出实时增量解析（支持跨节点分片），同时智能约束助手回复中的表情媒体尺寸（默认 `<= 160px`），不误伤普通技术图表与截图。
- **实时大小调节面板**：表情抽屉右上角内置设置按钮（⚙），支持 `小 / 中 / 大 / 超大` 一键档位与独立滑块实时调节贴纸、行内表情及助手媒体尺寸。
- **即点即发 / 输入框回填**：支持自由切换「点击直接发送」或「插入文本框编辑」，且在任意模式下均可通过 `Shift + 点击` 临时反转操作。

---

## 🚀 安装方法（Chrome / Edge / Brave）

1. 下载或克隆本仓库到本地：
   ```bash
   git clone https://github.com/krteke/gemini-meme-picker.git gemini-meme-picker
   ```
2. 打开浏览器扩展管理页面：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. 打开右上角 **开发者模式（Developer mode）**。
4. 点击 **加载已解压的扩展程序（Load unpacked）**，选择 `gemini-meme-picker` 根目录。
5. 打开或刷新 [Google Gemini](https://gemini.google.com/app)，底栏输入框旁即会出现微笑表情按钮。

---

## 🎯 使用技巧

- **快速搜索**：打开面板后焦点自动位于搜索框，支持中文描述、英文情绪词或拼音检索（例如输入 `happy`、`moyu`、`炸毛`），按 `Enter` 可直接选中第一张匹配表情，按 `Esc` 清空或关闭面板。
- **即点即发与微调**：
  - 开启「点击直接发送」时：左键点击直接发送；按住 `Shift + 左键点击` 插入文本框继续编辑。
  - 关闭「点击直接发送」时：左键点击插入文本框；按住 `Shift + 左键点击` 直接发送。
- **批量导入与管理**：在「我的收藏」中可将图片直接拖入面板或点击 `+ 导入`；鼠标悬停在自定义表情卡片上可进行重命名（`✎`）或删除（`✕`）。

---

## 🛠️ 自定义默认预设图库（纯 Node.js）

本项目内置 23 张压缩优化后的 `.webp` 预设表情，如需增删或替换默认预设：

1. 将图片（支持 `.webp` / `.png` / `.jpg` / `.jpeg` / `.gif`）放入 `assets/presets/default/`（推荐命名格式：`01-名称.webp`）。
2. 运行同步脚本更新 `assets/presets/manifest.json`（保留已有关键词配置）：
   ```bash
   pnpm run presets:sync
   ```
3. 在浏览器扩展页点击刷新即可生效。

---

## 🐱 推荐搭配：双向互动人设指令

单装扩展可向 Gemini 发送表情包并在本地渲染为贴纸；若将下方指令添加到 Gemini 网页端的 **「保存的信息（Saved Info）」** 或自定义 **Gem** 中，Gemini 将能理解 `[表情: 名称]` 情绪并用同款贴纸标记接梗回复：

```markdown
# Role: Gemini 娘（极其猫 / Gemini-chan）表情包双向联动指令

当你在对话中收到用户发送的 `[表情: 名称]`（例如 `[表情: 开心]`、`[表情: 困困]`、`[表情: 摸鱼]`、`[表情: 哈气]`）时，请直接将其理解为对应的情绪信号，以自然鲜活的口吻接梗互动。

在问候、任务完成、被夸奖、吐槽报错或道别等情绪节点，可以在回复句末附带 1 个预设表情标记（每条回复最多 1 个）：
- 可选名称列表：开心、早安、晚安、收到、谢谢、好耶、疑惑、震惊、哭哭、委屈、生气、害羞、偷笑、得意、摸鱼、加油、抱抱、点赞、无语、饿饿、困困、再见、哈气
- 输出格式（置于句末）：[表情: 开心]
```

---

## 📁 项目结构

```text
gemini-meme-picker/
├── manifest.json                 # Chrome Extension Manifest V3 配置
├── package.json                  # 脚本与测试入口
├── assets/
│   └── presets/
│       ├── manifest.json         # 预设表情元数据与关键词索引
│       └── default/              # 23 张 256px WebP 默认表情贴纸
├── icons/                        # 扩展图标 (16 / 48 / 128)
├── popup/                        # 扩展弹窗界面 (状态统计 / 开关 / 人设复制)
├── scripts/
│   └── build-presets.mjs         # Node.js 预设清单同步脚本
├── src/
│   ├── storage.js                # 预设加载、chrome.storage.local 持久化、图片压缩与搜索
│   ├── gemini-adapter.js         # Gemini Web 编辑器注入、发送控制与主题检测
│   ├── renderer.js               # 自适应气泡贴纸与助手媒体尺寸约束渲染引擎
│   ├── picker.js                 # 5 列表情抽屉 UI（纯 DOM 构建，兼容 Trusted Types）
│   ├── content.js                # 生命周期与 MutationObserver 增量监听
│   └── styles.css                # 浅色 / 深色自适应样式与气泡贴纸样式
└── tests/
    └── extension.test.mjs        # 自动化测试套件 (node --test)
```

---

## ⚠️ 工作原理与隐私安全

- **Trusted Types 兼容**：针对 `gemini.google.com` 严格的 CSP 策略，所有扩展 UI 与图标均采用纯 DOM API（`createElement` / `createElementNS` / `textContent`）构建，不使用 `innerHTML`。
- **本地隐私存储**：自定义收藏图片与偏好设置仅存储在本地浏览器扩展存储空间（`chrome.storage.local`），不会上传至任何第三方服务器。
- **文本标记机制**：发送时向输入框写入 `[表情: 名称]` 标记，并由本扩展在页面端实时渲染为贴纸图片；未安装扩展的设备将看到原始文本标记。

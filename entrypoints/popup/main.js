import presetManifest from "../../public/assets/presets/manifest.json";
import {
  onStorageChanged,
  openTab,
  storageGet,
  storageSet,
} from "../../src/lib/ext-api.js";
import {
  SIZE_PRESETS,
  STORAGE_KEY_AUTOSEND,
  STORAGE_KEY_CUSTOM,
  STORAGE_KEY_SIZES,
  normalizeSizeSettings,
} from "../../src/lib/storage.js";

const PERSONA_PROMPT = `# Role: Gemini 娘（极其猫 / Gemini-chan）表情包双向联动指令

当你在对话中收到用户发送的 \`[表情: 名称]\`（例如 \`[表情: 开心]\`、\`[表情: 困困]\`、\`[表情: 摸鱼]\`、\`[表情: 哈气]\`）时，请直接将其理解为对应的情绪信号，以自然鲜活的口吻接梗互动。

在问候、任务完成、被夸奖、吐槽报错或道别等情绪节点，可以在回复句末附带 1 个预设表情标记（每条回复最多 1 个）：
- 可选名称列表：开心、早安、晚安、收到、谢谢、好耶、疑惑、震惊、哭哭、委屈、生气、害羞、偷笑、得意、摸鱼、加油、抱抱、点赞、无语、饿饿、困困、再见、哈气
- 输出格式（置于句末）：[表情: 开心]

注意：日常闲聊可保持可爱活泼；进入技术解答、代码编写或严谨分析时必须保持专业准确。`;

function showStatus(text) {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = text;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = "";
  }, 2400);
}

function updateSizeUi(rawSizes) {
  const s = normalizeSizeSettings(rawSizes);
  const summaryEl = document.getElementById("size-summary");
  if (summaryEl) {
    summaryEl.textContent = `贴纸 ${s.standalone}px / 行内 ${s.inline}px`;
  }

  document.querySelectorAll("#size-preset-row .size-chip").forEach((chip) => {
    const preset = SIZE_PRESETS.find((p) => p.id === chip.dataset.preset);
    const active = Boolean(
      preset &&
      preset.standalone === s.standalone &&
      preset.inline === s.inline &&
      preset.assistantMax === s.assistantMax,
    );
    chip.classList.toggle("active", active);
  });
}

async function initPopup() {
  const presetCountEl = document.getElementById("preset-count");
  const customCountEl = document.getElementById("custom-count");
  const autoSendToggle = document.getElementById("autosend-toggle");
  const openGeminiBtn = document.getElementById("open-gemini-btn");
  const copyPromptBtn = document.getElementById("copy-prompt-btn");

  presetCountEl.textContent = Array.isArray(presetManifest)
    ? String(presetManifest.length)
    : "0";

  const data = await storageGet([
    STORAGE_KEY_CUSTOM,
    STORAGE_KEY_AUTOSEND,
    STORAGE_KEY_SIZES,
  ]);
  const customList = Array.isArray(data[STORAGE_KEY_CUSTOM])
    ? data[STORAGE_KEY_CUSTOM]
    : [];
  customCountEl.textContent = String(customList.length);
  autoSendToggle.checked = data[STORAGE_KEY_AUTOSEND] !== false;
  updateSizeUi(data[STORAGE_KEY_SIZES]);

  onStorageChanged((changes) => {
    if (changes[STORAGE_KEY_CUSTOM]) {
      const nextList = Array.isArray(changes[STORAGE_KEY_CUSTOM].newValue)
        ? changes[STORAGE_KEY_CUSTOM].newValue
        : [];
      customCountEl.textContent = String(nextList.length);
    }
    if (changes[STORAGE_KEY_AUTOSEND]) {
      autoSendToggle.checked = changes[STORAGE_KEY_AUTOSEND].newValue !== false;
    }
    if (changes[STORAGE_KEY_SIZES]) {
      updateSizeUi(changes[STORAGE_KEY_SIZES].newValue);
    }
  });

  document.querySelectorAll("#size-preset-row .size-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const preset = SIZE_PRESETS.find((p) => p.id === chip.dataset.preset);
      if (!preset) return;
      const payload = {
        standalone: preset.standalone,
        inline: preset.inline,
        assistantMax: preset.assistantMax,
      };
      await storageSet({ [STORAGE_KEY_SIZES]: payload });
      updateSizeUi(payload);
      showStatus(`已切换为「${preset.label}」尺寸`);
    });
  });

  autoSendToggle.addEventListener("change", async (e) => {
    await storageSet({ [STORAGE_KEY_AUTOSEND]: e.target.checked });
    showStatus(
      e.target.checked ? "已开启：点击直接发送" : "已切换：点击插入文本框",
    );
  });

  openGeminiBtn.addEventListener("click", () => {
    openTab("https://gemini.google.com/app");
  });

  copyPromptBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PERSONA_PROMPT);
      showStatus("已复制人设指令，可粘贴到 Gemini「保存的信息」或 Gem");
    } catch (_) {
      showStatus("复制失败，请手动查看 README");
    }
  });
}

document.addEventListener("DOMContentLoaded", initPopup);

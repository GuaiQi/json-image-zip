/**
 * 从 jsonData 批量拉取图片并打成 ZIP。
 * 数据文件需在 HTML 中先于本脚本引入，且导出 `jsonData`。
 */

/** 与 JSON 结构对应的字段配置（改数据格式时只改这里） */
const DATA = {
  /** 根对象上的数组字段，例如 { items: [...] } */
  listKey: 'items',
  /** 每条记录里图片地址的字段名 */
  imageUrlKey: 'image',
};

const LIBS = {
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  fileSaver: 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
};

const RUN = {
  /** 同时发起的请求数 */
  concurrent: 4,
  /** 每批之间的间隔（毫秒），减轻对源站压力 */
  batchGapMs: 200,
  zip: {
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  },
};

// ——— 工具函数 ——————————————————————————————————————————

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(el);
  });
}

function basenameFromUrl(urlString) {
  try {
    const { pathname } = new URL(urlString);
    return decodeURIComponent(pathname.split('/').pop() || 'image');
  } catch {
    return `image_${Date.now()}.bin`;
  }
}

/** ZIP 内文件名：序号 + 原文件名，避免重名覆盖、便于排序 */
function zipEntryFilename(orderIndex, totalCount, urlString) {
  const width = String(totalCount).length;
  const n = String(orderIndex + 1).padStart(width, '0');
  return `${n}_${basenameFromUrl(urlString)}`;
}

function pickImageUrls(root) {
  if (!root || typeof root !== 'object') return [];
  const list = root[DATA.listKey];
  if (!Array.isArray(list)) return [];
  const key = DATA.imageUrlKey;
  return list
    .map((row) => (row && typeof row === 'object' ? row[key] : null))
    .filter((u) => typeof u === 'string' && u.length > 0);
}

function el(id) {
  return document.getElementById(id);
}

function formatTimestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ——— 主流程 ————————————————————————————————————————————

async function packImagesToZip() {
  const btn = el('startBtn');
  const status = el('status');
  const progress = el('progress');
  const log = el('log');

  const setStatus = (msg) => {
    status.textContent = msg;
  };

  const logLine = (line) => {
    log.textContent += `${log.textContent ? '\n' : ''}${line}`;
    log.scrollTop = log.scrollHeight;
  };

  btn.disabled = true;
  log.textContent = '';
  progress.hidden = false;
  progress.value = 0;

  try {
    await loadScript(LIBS.jszip);
    await loadScript(LIBS.fileSaver);
  } catch (err) {
    setStatus('依赖加载失败，请检查网络后重试。');
    logLine(err.message || String(err));
    btn.disabled = false;
    progress.hidden = true;
    return;
  }

  if (typeof JSZip === 'undefined' || typeof saveAs !== 'function') {
    setStatus('JSZip 或 FileSaver 未正确暴露，请刷新重试。');
    btn.disabled = false;
    progress.hidden = true;
    return;
  }

  if (typeof jsonData === 'undefined') {
    setStatus('未找到 jsonData：请先在页面中引入数据脚本。');
    btn.disabled = false;
    progress.hidden = true;
    return;
  }

  const urls = pickImageUrls(jsonData);
  if (urls.length === 0) {
    setStatus(
      `没有可用的图片地址：请确认 jsonData.${DATA.listKey}[].${DATA.imageUrlKey} 存在且非空。`
    );
    btn.disabled = false;
    progress.hidden = true;
    return;
  }

  const zip = new JSZip();
  const { concurrent, batchGapMs, zip: zipOpts } = RUN;
  const total = urls.length;
  let ok = 0;
  let finished = 0;

  setStatus(`下载中 0 / ${total}`);

  for (let offset = 0; offset < total; offset += concurrent) {
    const chunk = urls.slice(offset, offset + concurrent);

    await Promise.allSettled(
      chunk.map(async (imageUrl, j) => {
        const i = offset + j;
        const filename = zipEntryFilename(i, total, imageUrl);
        try {
          const response = await fetch(imageUrl, { mode: 'cors' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          zip.file(filename, blob);
          ok += 1;
          logLine(`✓ ${i + 1}/${total}  ${filename}`);
        } catch {
          logLine(`✗ ${i + 1}/${total}  ${imageUrl}`);
        } finally {
          finished += 1;
          progress.value = Math.round((finished / total) * 100);
          setStatus(`下载中 ${finished} / ${total}`);
        }
      })
    );

    await new Promise((r) => setTimeout(r, batchGapMs));
  }

  setStatus(`正在压缩（已成功 ${ok} / ${total}）…`);

  const blob = await zip.generateAsync(zipOpts, (meta) => {
    if (meta.percent != null) progress.value = Math.round(meta.percent);
  });

  saveAs(blob, `images_${formatTimestampForFilename()}.zip`);
  setStatus(`完成：${ok} / ${total} 张已写入 ZIP，浏览器已开始下载。`);
  btn.disabled = false;
}

function init() {
  const btn = el('startBtn');
  const meta = el('metaLine');

  if (typeof jsonData === 'undefined') {
    meta.textContent =
      '未检测到 jsonData：请在 HTML 中于本脚本之前引入数据文件（见页面底部注释）。';
    el('status').textContent = '';
    btn.disabled = true;
    return;
  }

  const n = pickImageUrls(jsonData).length;
  meta.textContent =
    n > 0
      ? `已载入 jsonData · ${DATA.listKey}[].${DATA.imageUrlKey} · 共 ${n} 条地址`
      : `已载入 jsonData，但未解析到图片地址（检查 ${DATA.listKey} / ${DATA.imageUrlKey}）`;

  btn.addEventListener('click', () => {
    packImagesToZip().catch((err) => {
      el('status').textContent = `出错：${err.message || String(err)}`;
      el('startBtn').disabled = false;
      el('progress').hidden = true;
    });
  });
}

init();

# JSON 图片批量打包

在浏览器里打开静态页面，从全局变量 `jsonData` 中读取图片地址列表，批量下载后打成 **一个 ZIP**，再通过浏览器保存到本地。适合从导出的维基/图鉴类 JSON 里一次性拉取缩略图等场景。

## 使用步骤

1. **准备数据文件**  
   写一个 `.js` 文件，暴露全局变量（名称必须是 `jsonData`），例如：

   ```js
   const jsonData = {
     items: [
       { image: "https://example.com/a.png" },
       { image: "https://example.com/b.png" },
     ],
   };
   ```

2. **在 HTML 里按顺序引入脚本**  
   数据脚本 **必须** 写在 `index.js` **之前**，否则页面里没有 `jsonData`：

   ```html
   <script src="./your-data.js"></script>
   <script src="./index.js"></script>
   ```

   仓库里的 `index.html` 在底部留了注释示例，取消注释并把路径改成你的数据文件即可。

3. **用浏览器打开 `index.html`**（本地 `file://` 或通过任意静态服务器均可）。

4. 点击 **「开始打包下载」**，等待进度走完；成功后浏览器会下载形如 `images_2026-04-14T12-30-45.zip` 的文件。

## 数据格式约定

默认约定（可在 `index.js` 里改配置，见下节）：

| 位置 | 含义 |
|------|------|
| `jsonData` | 根对象，由数据脚本定义 |
| `jsonData.items` | 数组，列表键名由 `DATA.listKey` 指定，默认 `items` |
| `jsonData.items[].image` | 每条记录的图片 URL 字符串，字段名由 `DATA.imageUrlKey` 指定，默认 `image` |

空字符串或缺失的 URL 会被跳过；ZIP 内文件名规则为：`序号_原 URL 最后一段文件名`，避免同名互相覆盖并保持排序。

## 配置说明（`index.js`）

- **`DATA`**  
  - `listKey`：根对象上的数组字段名。  
  - `imageUrlKey`：每条记录里图片地址的字段名。  

- **`RUN`**  
  - `concurrent`：并发请求数。  
  - `batchGapMs`：每批之间的间隔（毫秒），略减轻对图片源站的压力。  
  - `zip`：传给 JSZip 的生成选项（压缩方式、等级等）。

- **`LIBS`**  
  JSZip、FileSaver 的 CDN 地址；首次点击「开始」时动态加载。

## 界面说明

- **灰色提示条**：若已成功加载 `jsonData`，会显示当前使用的字段路径与解析到的 URL 条数。  
- **状态行**：当前阶段说明（下载 / 压缩）。  
- **进度条**：下载与生成 ZIP 时的整体进度。  
- **日志区**：每张成功或失败一行；失败多为网络或跨域问题。

## 常见问题

**1. 提示「未检测到 jsonData」**  
数据脚本未引入、或写在 `index.js` 之后。请保证 `<script src="数据.js">` 在 `<script src="index.js">` 之前。

**2. 大量「✗」失败**  
图片域名未对当前页面来源开放 **CORS**，浏览器会拦截 `fetch`。可换用允许跨域的 CDN、或通过本地/自建代理在同源下转发图片（本仓库未包含代理）。在 `file://` 打开时，部分环境行为也可能与 `http://localhost` 不一致，可尝试用简单静态服务访问页面。

**3. ZIP 里数量少于 JSON 条数**  
部分 URL 无效、被跨域拦截或返回非 2xx，对应项不会写入 ZIP；以日志区为准。

## 开发者可选：临时关闭跨域限制（Chrome）

仅适合 **本机临时调试**：用单独用户数据目录启动 Chrome，并关闭 Web 安全策略后，同源/CORS 限制会放宽，部分被 CORS 拦截的 `fetch` 可能可以成功。**不要**用它作为日常上网的主浏览器。

**安全风险（请务必阅读）**

- `--disable-web-security` 会削弱整实例的浏览安全，恶意页面更容易窃取数据或执行危险操作。
- 仅用于拉图、调试本工具；不要在该窗口登录银行、邮箱等重要账号，不要访问不可信网站。
- 正式给他人使用或上线环境，仍应使用 **服务端代理** 或 **目标站配置 CORS**，不能依赖此方式。

**Windows 示例（快捷方式「目标」一栏）**

把 `chrome.exe` 路径换成你本机安装路径，用户数据目录可改成任意空目录（Chrome 会自动创建）：

```text
"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="%TEMP%\chrome-dev-profile"
```

其中 `%LOCALAPPDATA%`、`%TEMP%` 为 Windows 环境变量，系统会解析为你的本机路径，无需写死盘符或用户名。

保存快捷方式后，**用这个快捷方式**打开 Chrome，再访问本项目的 `index.html` 或本地静态服务地址。用完后可关闭该窗口；日常浏览请仍使用普通 Chrome。

**说明**：不同 Chrome 版本、不同操作系统路径可能不同；macOS / Linux 需自行写出对应的 `chrome`/`chromium` 可执行文件路径与引号规则。

## 文件一览

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构、样式与脚本引用顺序 |
| `index.js` | 打包逻辑、字段配置与依赖加载 |
| 你的 `*.js` 数据文件 | 定义 `jsonData`，按需自备 |

---

无需构建步骤；依赖在运行时从 CDN 加载，需能访问外网（或使用可访问的镜像地址替换 `LIBS` 中的 URL）。

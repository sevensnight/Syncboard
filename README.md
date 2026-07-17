# SyncBoard（内网通 Web 版）

一个面向同一局域网团队的轻量协作平台，集成了多人实时白板、房间聊天、文件共享、二维码分享、深浅色主题，以及适配手机 / 平板 / 桌面端的响应式界面。

房间内还可一键启动内嵌的**大富翁**与**飞行棋**小游戏（基于开源项目二次改编，见文末 [第三方开源致谢](#第三方开源致谢)）。

## 当前能力

- 房间级多人白板：画笔、橡皮擦、粗细/颜色调节、清空同步、历史回放
- 房间级公共聊天：系统消息、时间戳、Emoji 快捷输入、未读提醒
- 局域网文件共享：点击上传、拖拽上传、下载按钮、上传/下载进度提示
- 在线协作状态：当前房间、在线人数、在线成员设备类型、连接状态
- 局域网分享：唯一推荐内网地址、带房间参数的分享链接、二维码
- 响应式工作台：桌面侧栏、移动端抽屉、白板工具栏 FAB 显隐
- 深浅色主题：切换后自动持久化
- 内嵌小游戏：大富翁（Vite 开发服代理）、飞行棋（Spring Boot WebSocket）

## 启动方式

在项目根目录执行：

```bash
npm install
npm run build:css
npm start
```

默认监听：

- 本机地址：`http://localhost:3000`
- 局域网地址：终端中的 `朋友请访问 http://你的内网IP:3000`

端口策略统一为 **3000**。如果启动时提示端口占用，先清理旧进程再重启：

```bash
npm run clean:port
npm start
```

## 使用说明

### 1. 进入房间

1. 打开页面后填写用户名和房间名。
2. 点击“进入房间”。
3. 页面地址会自动变成带 `?room=房间名` 的分享链接。
4. 把这个链接发给同事，或直接让对方扫码进入同一房间。

### 2. 白板协作

- 支持鼠标和触摸绘制
- 桌面端可通过悬浮工具栏使用画笔、橡皮擦、颜色、粗细、清空
- 移动端通过底部工具抽屉操作
- 新成员进入房间后会自动拿到该房间已有白板历史

### 3. 聊天协作

- 聊天和文件区在右侧协作中心
- 支持公共频道消息、系统通知、Emoji 快捷输入
- 可一键清空当前房间聊天记录
- 当聊天面板未展开时，会显示未读数量

### 4. 文件共享

- 支持点击上传或拖拽上传
- 单文件最大 50MB
- 上传完成后，房间内其他成员会实时看到文件卡片
- 下载时会显示进度；若浏览器拿不到总长度，则会显示“正在下载…”状态

## 局域网分享说明

程序会自动筛选最可能真实可用的那一条局域网 IPv4 地址，并尽量排除常见虚拟网卡，例如：

- WSL
- Hyper-V
- VMware
- Docker
- Tailscale

启动成功后：

- 终端只打印一条推荐内网地址
- 页面顶部只展示一条当前分享地址
- 分享卡片会显示对应二维码
- 分享链接会自动携带房间参数，例如：`http://192.168.x.x:3000/?room=design-room`

## 项目结构

```text
server.js                 # 入口
src/server/               # Express + Socket.io 服务端
  routes/                 # 含 game-launcher（拉起大富翁 / 飞行棋）
  services/
  socket/
  utils/
public/                   # 前端静态资源
src/client/styles/        # Tailwind 源样式
games/
  monopoly/               # 大富翁（改编自 itaylayzer/Monopoly）
  aeroplane-chess/        # 飞行棋（改编自 kan01234/aeroplanes-chess）
scripts/                  # 端口清理、自检等
data/rooms/               # 房间持久化 JSON（运行时生成，不入库）
uploads/                  # 上传文件（运行时生成，不入库）
```

## 小游戏依赖（可选）

主白板只需根目录 `npm install` 即可。若要使用内嵌游戏：

```bash
# 大富翁
cd games/monopoly
npm install

# 飞行棋（需本机 Java 8+ 与 Maven）
cd games/aeroplane-chess
# 首次启动会自动 mvn package；也可手动：
mvn -DskipTests package
```

## 开发说明

### 样式构建

项目使用 Tailwind CSS，修改样式源文件后重新构建：

```bash
npm run build:css
```

### 数据存储

- **房间持久状态**（白板操作、聊天记录、文件元数据、云剪贴板）会写入项目根目录 `data/rooms/`
  - 变更后约 400ms 防抖落盘；服务关闭时强制刷盘
  - 在线用户 / 正在输入状态仍为内存态，重启后需重新连接
- 上传文件本体保存在项目根目录 `uploads/` 中
  - 房间文件列表超过上限时，会同步删除被淘汰文件的磁盘副本
- 白板图片地址使用相对路径（`/uploads/...`），避免本机 `localhost` 与局域网 IP 混用时跨设备加载失败
- 空房间（无白板/聊天/文件/剪贴板内容）不会保留持久化文件
- 飞行棋：房主可设机器人数量；**房间内所有真人都准备后**才会补机器人并开局；对局结束后可同房间再开一局

## 联调建议

建议至少开两个浏览器窗口，验证这些核心流程：

1. 两端进入同一房间
2. 白板绘制 / 橡皮擦 / 清空是否同步
3. 聊天消息和系统消息是否实时同步
4. 上传文件后另一端是否立即看到文件卡片并成功下载
5. 手机尺寸下侧栏抽屉和工具栏抽屉是否可用
6. 深浅色切换后刷新是否保留

## Windows 防火墙排查

如果你自己能打开，但局域网里的朋友打不开，通常按下面顺序排查：

1. **确认处于同一局域网**
   - 你的电脑和朋友设备必须接入同一个 Wi‑Fi 或同一个路由器。

2. **确认 Node.js 已允许通过防火墙**
   - 第一次运行时如果弹出 Windows 防火墙提示，需要允许“专用网络”。

3. **检查允许应用列表**
   - 打开：`控制面板 -> 系统和安全 -> Windows Defender 防火墙 -> 允许应用或功能通过 Windows Defender 防火墙`
   - 确认 `Node.js` 或 `node.exe` 在“专用网络”下已勾选。

4. **必要时清理并重启 3000 端口服务**
   - 运行：`npm run clean:port`
   - 然后运行：`npm start`


## 小提示

- 如果换了 Wi‑Fi，内网 IP 可能会变化，需要重新看终端输出的新地址。
- 如果二维码扫不开，可以直接复制页面里的分享链接到浏览器打开。
- 当前前端使用 `/socket.io/socket.io.js` 注入的全局 `io()` 客户端，不依赖单独安装 `socket.io-client`。

## 第三方开源致谢

本项目在房间协作能力之外，集成并**改编**了以下 GitHub 开源游戏，在此致谢原作者。请遵守各自仓库的开源协议（均为 MIT）。

### 飞行棋（Aeroplane Chess）

| 项目 | 说明 |
|------|------|
| 源仓库 | [kan01234/aeroplanes-chess](https://github.com/kan01234/aeroplanes-chess) |
| 相关依赖 | [kan01234/websocket-gameroom](https://github.com/kan01234/websocket-gameroom) |
| 原作者 | Kan.Leung（`kan01234`） |
| 协议 | MIT |
| 本仓库路径 | `games/aeroplane-chess/` |

原项目基于 Spring Boot WebSocket 实现飞行棋。本项目将其嵌入 SyncBoard：由主服务按需拉起 JAR、统一端口与房间流程，并做了房主设机器人、全员准备后开局、同房再开一局等适配与改动。

### 大富翁（Monopoly）

| 项目 | 说明 |
|------|------|
| 源仓库 | [itaylayzer/Monopoly](https://github.com/itaylayzer/Monopoly) |
| Demo | [itaylayzer.github.io/Monopoly](https://itaylayzer.github.io/Monopoly/) |
| 原作者 | Itay Layzerovich（`itaylayzer`） |
| 协议 | MIT |
| 本仓库路径 | `games/monopoly/` |

原项目为 React + Vite + Peer.js 的多人在线大富翁。本项目将其作为子应用嵌入：开发服由主服务在 `3001` 拉起，并调整 base 路径与局域网协作场景下的配置（如 `src/config.ts`）。

原 Monopoly README 中还致谢了 [danielstern 的 monopoly.json](https://github.com/danielstern/science/blob/master/monopoly.json) 等资源，详见上游仓库说明。


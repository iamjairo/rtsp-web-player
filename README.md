# 🎥 RTSP Web Player

A multi-stream IP-camera viewer that runs in the browser, as a cross-platform
desktop app (Electron), or in Docker.  It converts RTSP streams to either HLS
(~6-10 s latency) or low-latency fragmented MP4 over WebSocket (~1-3 s) using
FFmpeg, and also supports native WebRTC/WHEP sources and MJPEG streams.

## ✨ Features

| Feature | Details |
|---|---|
| **Multi-stream grid** | 1 / 2 / 3-column layout, add/remove cameras at any time |
| **HLS playback** | RTSP → HLS via FFmpeg (hls.js with auto-recovery) |
| **Low-latency WebSocket** | RTSP → fMP4 → WebSocket via MSE (~1-3 s latency) |
| **WebRTC / WHEP** | Native WebRTC source support via the WHEP protocol |
| **MJPEG** | Direct MJPEG HTTP streams |
| **Camera discovery** | ONVIF broadcast discovery + TP-Link Tapo cloud login |
| **Cross-platform desktop** | Electron builds for Windows, macOS and Linux (FFmpeg bundled) |
| **Docker** | Single-command containerised deployment |

---

## 📐 Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Browser / Electron (React + TypeScript + Tailwind)           │
│                                                               │
│  VideoPlayer.tsx                                              │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────────────┐ │
│  │  HLS.js │  │ MSE + WS │  │ WebRTC  │  │  <video src>   │ │
│  │  (hls)  │  │  (ws)    │  │ (WHEP)  │  │ (mjpeg/direct) │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └────────────────┘ │
└───────┼────────────┼─────────────┼───────────────────────────┘
        │ HTTP       │ WebSocket   │ HTTP (SDP)
┌───────▼────────────▼─────────────┘
│  Node.js / Express backend  (server/)                         │
│                                                               │
│  streamManager.js      RTSP ──► FFmpeg ──► HLS segments       │
│  webSocketManager.js   RTSP ──► FFmpeg ──► fMP4 ──► WS        │
│  cameraDiscovery.js    ONVIF / Tapo discovery                 │
└───────────────────────────────────────────────────────────────┘
```

---

## 📦 Download (Desktop App)

Pre-built desktop installers are attached to every
[GitHub Release](../../releases/latest).

| Platform | File | Notes |
|---|---|---|
| **Windows** | `RTSP-Web-Player-Setup-x.y.z.exe` | NSIS installer (recommended) |
| **Windows** | `RTSP-Web-Player-x.y.z.exe` | Portable — no install needed |
| **macOS** | `RTSP-Web-Player-x.y.z.dmg` | Drag to Applications |
| **macOS** | `RTSP-Web-Player-x.y.z-mac.zip` | Unzip and run |
| **Linux** | `RTSP-Web-Player-x.y.z.AppImage` | `chmod +x *.AppImage && ./RTSP-Web-Player*.AppImage` |
| **Linux** | `RTSP-Web-Player-x.y.z.deb` | `sudo dpkg -i *.deb` |

> **FFmpeg is bundled** inside the desktop app — no separate installation needed.

### macOS Gatekeeper note
Because the app is not notarised by default, macOS will block it on first
launch.  Right-click (or Control-click) the app icon and choose **Open**, then
confirm in the dialog.  To build a signed/notarised version, see
[Code Signing](#code-signing-electron) below.

---

## 🚀 Quick Start

### Option A — Web Mode (browser only)

Requires Node.js 18+ and FFmpeg installed on the host.

```bash
# 1. Install dependencies
npm run setup

# 2. Start the backend (Terminal 1)
npm run server

# 3. Start the frontend dev server (Terminal 2)
npm run dev
```

Open **http://localhost:5173** in your browser.

### Option B — Electron Desktop App (development)

```bash
npm run setup
npm run electron:dev
```

### Option C — Docker

```bash
docker compose up --build
```

- Frontend → **http://localhost:80**
- Backend API → **http://localhost:3001**

> The `VITE_API_URL` environment variable controls which backend URL the
> browser frontend uses.  Set it to your server's public IP/hostname when
> deploying remotely:
>
> ```bash
> VITE_API_URL=http://192.168.1.100:3001 docker compose up --build
> ```

---

## 📋 Prerequisites (web/server mode)

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 18 + | Runtime |
| FFmpeg | any modern | RTSP transcoding |
| npm | 9 + | Package management |

**FFmpeg installation:**

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html and add to PATH
```

---

## 🎥 Adding Cameras

Click the **+** button (bottom right) and enter:

| Field | Example |
|---|---|
| Name | Front Door |
| URL | `rtsp://admin:pass@192.168.1.100:554/stream1` |

For RTSP URLs, two conversion modes are available:

- **HLS (default)** — most compatible, ~6-10 s latency
- **Low-latency WebSocket** — ~1-3 s latency, requires H.264 source and Chrome/Edge

For non-RTSP sources, select the stream type manually:

| Type | URL format | Description |
|---|---|---|
| `hls` | `http://…/stream.m3u8` | HTTP Live Streaming |
| `mjpeg` | `http://…/video.mjpg` | Motion JPEG |
| `webrtc` | `http://…/whep` | WebRTC WHEP endpoint |
| `ws` | `ws://…/api/ws-streams/id/live` | WebSocket fMP4 stream |

---

## 🌐 Backend API

All endpoints are served at `http://localhost:3001`.

### HLS Streams (RTSP → HLS)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/streams` | List active HLS streams |
| `POST` | `/api/streams` | Start a new HLS stream `{ id, rtspUrl }` |
| `GET` | `/api/streams/:id` | Get stream info |
| `DELETE` | `/api/streams/:id` | Stop stream |

### WebSocket Streams (RTSP → low-latency fMP4)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ws-streams` | List active WS streams |
| `POST` | `/api/ws-streams` | Start a new WS stream `{ id, rtspUrl }` |
| `GET` | `/api/ws-streams/:id` | Get stream info |
| `DELETE` | `/api/ws-streams/:id` | Stop stream |
| `WS` | `/api/ws-streams/:id/live` | WebSocket connection for fMP4 data |

### Camera Discovery

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/discovery/start` | Start ONVIF/Tapo discovery |
| `GET` | `/api/discovery/status` | Discovery progress |
| `GET` | `/api/discovery/devices` | Discovered devices |
| `POST` | `/api/discovery/test` | Test camera credentials |
| `POST` | `/api/discovery/rtsp-urls` | Generate RTSP URL suggestions |
| `DELETE` | `/api/discovery/clear` | Clear discovered devices |

---

## 🏗️ Building the Desktop App

```bash
# Install all dependencies first
npm run setup

# Build for the current platform
npm run electron:build

# Outputs are placed in release/
```

### Cross-platform builds

Each platform **must be built on a matching host** (or CI runner):

| Platform | Build host |
|---|---|
| Windows | `windows-latest` |
| macOS | `macos-latest` |
| Linux | `ubuntu-latest` |

The included [GitHub Actions release workflow](.github/workflows/release.yml)
handles all three platforms automatically when you push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Code signing (Electron)

**macOS** — add these repository secrets in GitHub → Settings → Secrets:

| Secret | Value |
|---|---|
| `CSC_LINK` | Base64-encoded `.p12` certificate (export from Keychain) |
| `CSC_KEY_PASSWORD` | Certificate passphrase |

**Windows** — add `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` to the workflow env.

Without secrets, the builds still succeed but will be unsigned.

---

## 🐳 Docker Reference

```bash
# Build and start
docker compose up --build -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after code changes
docker compose up --build
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend API port |
| `STATIC_PORT` | `80` | Frontend static server port |
| `VITE_API_URL` | `http://localhost:3001` | Backend URL seen by the browser |

---

## 🔧 Configuration

The frontend detects automatically whether it's running inside Electron or a
browser and configures the API base URL accordingly.  In browser mode, set
`VITE_API_URL` at build time:

```bash
VITE_API_URL=http://my-server:3001 npm run build
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| Video doesn't load | Check the backend is running (`npm run server`) |
| "FFmpeg not found" | Install FFmpeg or use the desktop app (FFmpeg bundled) |
| High latency | Use the **Low-latency WebSocket** mode when adding the camera |
| macOS blocks the app | Right-click → Open → confirm in Gatekeeper dialog |
| Linux AppImage won't run | Run `chmod +x *.AppImage` first |
| WebRTC stream fails | Verify the WHEP endpoint URL and that the camera is reachable |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

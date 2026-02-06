# TubeScribe

An Obsidian plugin that syncs YouTube playlist transcripts into your vault. Add a video to a playlist, sync, and a note appears with the full transcript and metadata. No API keys, no external services.

**Desktop only** — requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed locally.

## Features

- Watch multiple YouTube playlists
- Automatic transcript extraction via yt-dlp
- Smart deduplication — only syncs new videos
- Customisable note templates with `{{variable}}` substitution
- Configurable filename format
- Optional playlist subfolders
- Flexible timestamp formats (per segment, every 30s/60s, or none)
- Manual and auto-generated caption support
- Sync on startup, on interval, or manually via command palette / ribbon icon

## Prerequisites

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp):

```bash
# macOS
brew install yt-dlp

# Linux
sudo apt install yt-dlp

# Windows
winget install yt-dlp
```

## Installation

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder: `<vault>/.obsidian/plugins/obsidian-tubescribe/`
3. Copy the three files into that folder
4. Enable the plugin in Obsidian Settings > Community Plugins

## Usage

1. Open Settings > TubeScribe
2. Click "Test" to verify yt-dlp is detected
3. Add a YouTube playlist (name + URL)
4. Click the play button in the ribbon, or run "TubeScribe: Sync now" from the command palette

## Settings

| Section | Settings |
|---------|----------|
| **Connection** | yt-dlp path (auto-detect or manual), test button |
| **Playlists** | Add/remove playlists with name, URL, and enable/disable toggle |
| **Vault** | Output folder, group by playlist, note template path, filename format |
| **Schedule** | Sync on startup, auto-sync interval (1h/6h/12h/24h) |
| **Transcript** | Preferred languages, include auto-generated captions, timestamp format, create note without transcript |

## Development

```bash
npm install
npm run build    # Production build
npm run dev      # Watch mode
```

See [CLAUDE.md](CLAUDE.md) for architecture details.

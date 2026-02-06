# CLAUDE.md

## Project Overview

**obsidian-tubescribe** — An Obsidian plugin that watches YouTube playlists and creates a note per video containing the transcript. Add a video to a playlist, sync, and a note appears in your vault with full transcript and metadata. No API keys, no external services.

## Architecture

- **Language:** TypeScript (standard Obsidian plugin)
- **Build:** esbuild (standard Obsidian plugin toolchain)
- **External dependency:** yt-dlp binary (user-installed)
- **Desktop only:** due to yt-dlp binary dependency
- **Node APIs:** `child_process.execFile` (yt-dlp), `fs/promises` (temp files), `os.tmpdir`
- **Zero runtime npm dependencies** — only Node built-ins and Obsidian API

### Module Structure

```
src/
  main.ts        — Plugin lifecycle, commands, ribbon icon, auto-sync scheduling
  types.ts       — All interfaces, type definitions, and default settings
  settings.ts    — TubescribeSettingTab (5 sections: Connection, Playlists, Vault, Schedule, Transcript)
  ytdlp.ts       — yt-dlp binary detection, playlist fetch, video metadata, transcript download
  vtt-parser.ts  — VTT parsing with rolling dedup for YouTube auto-captions
  template.ts    — Template loading, {{variable}} rendering, filename generation
  sync.ts        — Sync engine orchestration (the core business logic)
```

## Development

### Build & Test

```bash
npm install          # Install dependencies
npm run build        # Production build → main.js
npm run dev          # Watch mode for development
```

### Test Vault

A test vault exists at `test/test-tubescribe/` with the plugin pre-installed. Open it in Obsidian to test. After building, copy the output:

```bash
cp main.js test/test-tubescribe/.obsidian/plugins/obsidian-tubescribe/
```

### Key Files

- `CLAUDE.md` - This file (technical guide for AI assistants)
- `DEVLOG` - Development log with dated entries
- `README.md` - User-facing documentation
- `TODO.md` - Task tracking
- `docs/requirements.md` - Original project requirements
- `docs/features/` - Feature spec files

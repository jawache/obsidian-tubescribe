# Feature Spec: Playlist Transcript Sync

**Status:** Planned
**Created:** 2026-02-06
**Last Updated:** 2026-02-06

## Overview

The core feature of TubeScribe: watch configured YouTube playlists, fetch transcripts via yt-dlp, and create a note per video in the vault with full transcript and metadata. No API keys, no external services — just a locally installed yt-dlp binary.

## Problem Statement

Getting YouTube transcripts into Obsidian is a manual, tedious process. You have to visit each video, copy the transcript, paste it into a note, and add metadata by hand. This plugin automates the entire pipeline: add a video to a YouTube playlist, sync, and a note appears in your vault.

## Solution

A desktop-only Obsidian plugin that shells out to yt-dlp for playlist metadata and subtitle downloads. Notes are created from a configurable template with `{{variable}}` substitution. Deduplication is handled via `video_id` in frontmatter, so subsequent syncs only process new videos.

## Architecture

### Module Structure

```
src/
  main.ts          # Plugin lifecycle, commands, ribbon, intervals, isSyncing guard
  types.ts         # All interfaces and type definitions
  settings.ts      # TubescribeSettingTab — full settings UI (5 sections)
  ytdlp.ts         # yt-dlp binary detection, playlist fetch, transcript download
  vtt-parser.ts    # VTT parsing, deduplication, timestamp formatting
  template.ts      # Template loading, variable substitution, filename generation
  sync.ts          # Sync engine — orchestrates the full workflow
```

**Zero runtime npm dependencies.** Only Node built-ins (`child_process`, `fs/promises`, `os`, `path`, `util`) and the Obsidian API.

### Key Design Decisions

1. **Direct `execFile` instead of `youtube-dl-exec`** — lighter weight, no shell injection risk, no bundled binary
2. **Two-pass metadata fetch** — `--flat-playlist` for fast ID list, then `--dump-json` per *new* video only (avoids refetching already-synced videos)
3. **Manual VTT parser** (~80 lines) — handles YouTube-specific quirks (rolling duplicates, inline timestamps, colour tags) that generic parsers don't address
4. **Simple `{{variable}}` string replacement** — no template engine dependency needed for flat variables
5. **Sequential per-video processing with 1.5s delay** — rate limiting courtesy, meaningful progress notices

### Sync Engine Flow

1. Resolve yt-dlp binary path (configured or auto-detect)
2. Filter to enabled playlists
3. Ensure output folder exists
4. Scan existing notes for `video_id` in frontmatter (via Obsidian's metadata cache)
5. Load note template (custom or built-in default)
6. Per playlist:
   - Fetch video IDs via `--flat-playlist --dump-json`
   - Filter to new (unseen) videos
   - Per new video:
     - Fetch full metadata via `--dump-json`
     - Download transcript to temp dir
     - Parse VTT, deduplicate, format with timestamps
     - Render template, generate filename, create note
     - Sleep 1.5s (rate limiting)
7. Clean up temp directory
8. Show completion notice with counts

### Edge Cases

- **Concurrent sync prevention** — `isSyncing` flag in main.ts
- **Filename collisions** — append ` (2)`, ` (3)` etc.
- **Missing transcripts** — create note with `has_transcript: false` and placeholder (configurable)
- **Per-video errors** — caught individually, don't block rest of sync
- **Large playlists** — `maxBuffer: 50MB` for execFile, progress notices per video

## Implementation Plan

### Phase 1: Project Scaffolding
Create `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `styles.css`, `src/types.ts`, and a minimal `src/main.ts` that loads in Obsidian with a ribbon icon.

**Verify:** `npm install && npm run build` succeeds; plugin loads in Obsidian.

### Phase 2: Settings System
Create `src/settings.ts` with all five sections (Connection, Playlists, Vault, Schedule, Transcript). Wire up `loadSettings()`/`saveSettings()` in `main.ts`.

**Verify:** Settings tab renders, values persist across reloads.

### Phase 3: yt-dlp Integration
Create `src/ytdlp.ts` with:
- `resolveYtdlpPath()` — auto-detect or use configured path
- `testYtdlp()` — version check for the "Test" button
- `fetchPlaylistMetadata()` — `--flat-playlist --dump-json`, parse NDJSON
- `fetchVideoMetadata()` — full `--dump-json` for a single video
- `downloadTranscript()` — subtitle download to temp dir, return VTT string or null

**Verify:** "Test" button shows yt-dlp version; playlist fetch logs video IDs to console.

### Phase 4: VTT Parser
Create `src/vtt-parser.ts` with:
- `parseVTT()` — parse cues, strip HTML tags/entities, deduplicate rolling captions
- `formatTranscript()` — apply timestamp format (segment/30s/60s/none)
- `formatTranscriptRaw()` — plain text, no timestamps

**Verify:** Parse a real YouTube auto-generated VTT; inspect deduplication quality.

### Phase 5: Template Engine
Create `src/template.ts` with:
- `getDefaultTemplate()` — built-in template from the spec
- `loadTemplate()` — read custom template from vault or fall back to default
- `renderTemplate()` — `{{variable}}` global replace
- `generateFilename()` — render format string, sanitise illegal chars
- `formatDuration()`, `formatDate()` — helper formatters

**Verify:** Rendered template has all variables replaced correctly.

### Phase 6: Sync Engine
Create `src/sync.ts` — tie everything together. Wire up in `main.ts`: ribbon icon, command, `isSyncing` guard, startup sync (5s delay), auto-sync interval.

**Verify:** Configure a real playlist, sync, verify notes appear with correct frontmatter and transcript.

### Phase 7: Polish
- Settings validation (playlist URL format)
- Auto-sync interval change handling
- Notice UX (persistent progress, summary counts)
- Playlist URL normalisation

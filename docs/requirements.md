
# YouTube Transcript Sync Plugin — Spec

An Obsidian plugin that watches one or more YouTube playlists and creates a note per video containing the transcript. Notes land in chaos (`1-chaos/external/youtube-transcripts/`) as raw source material for later processing into knowledge. Transcripts come directly from YouTube's captions (manual or auto-generated), not from any speech-to-text service.

The goal is simple: add a video to a YouTube playlist, and the next time Obsidian syncs, a note appears in the vault with the full transcript and metadata. No API keys, no external services, no manual steps.

## Why yt-dlp over the YouTube Data API

The initial instinct was to use the YouTube Data API v3 for playlist fetching and a separate npm transcript library (`youtube-transcript` or `youtube-transcript-plus`) for captions. This would require a Google Cloud API key, even for unlisted playlists (unlisted playlists are accessible via API key, no OAuth needed, but the key setup is still friction).

yt-dlp eliminates this entirely. It handles both jobs (playlist metadata and subtitle download) with zero API keys, zero Google Cloud setup. It's the most actively maintained open-source project touching YouTube, with a huge community that responds quickly when YouTube changes things. The npm transcript libraries use undocumented YouTube endpoints and are less actively maintained, making them a reliability risk.

The trade-off is that yt-dlp is a binary dependency. The plugin needs to shell out to it rather than calling a native JS library. This makes it desktop-only and slightly messier architecturally. But `youtube-dl-exec` (an npm wrapper) handles this reasonably well, and plenty of Obsidian plugins bundle or depend on external tools. The reliability gain is worth the architectural compromise.

yt-dlp commands needed:

- **Playlist metadata:** `yt-dlp --flat-playlist --dump-json "<playlist_url>"` returns one JSON object per line, per video. Fields include `id`, `title`, `uploader`, `upload_date`, `duration`, `description`.
- **Transcript download:** `yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang "en" --sub-format vtt --convert-subs vtt "<video_url>"` downloads captions as WebVTT without downloading the video itself.

## Plugin settings

### Connection

**yt-dlp path** — Path to the yt-dlp binary. Empty means auto-detect (checks `yt-dlp`, `/usr/local/bin/yt-dlp`, `/opt/homebrew/bin/yt-dlp`). A "Test" button in settings verifies the binary works.

### Playlists

A list of playlist configurations, each with three fields: a friendly name (for display in notices and frontmatter), a YouTube playlist URL, and an enabled/disabled toggle. Users can add and remove playlists from the settings tab. The plugin extracts the playlist ID from the URL internally.

### Vault

**Output folder** — Where transcript notes are created. Defaults to `1-chaos/external/youtube-transcripts`. This follows the Mycelium convention of external chaos: raw material from the outside world that hasn't been synthesised yet.

**Note template** — Path to a template file in the vault (e.g. `2-life/templates/youtube-transcript.md`). If empty, uses a sensible built-in default. The template uses double-brace variables (`{{title}}`, `{{transcript}}`, etc.) that get replaced at note creation time.

**Filename format** — A template string for generating filenames. Default: `{{published}} - {{title}}`. Available variables: `{{published}}`, `{{title}}`, `{{channel}}`, `{{synced}}`, `{{video_id}}`. Characters that are illegal in filenames (`/\:*?"<>|`) get replaced with hyphens.

### Schedule

**Sync on startup** — Toggle. When enabled, runs a sync automatically when Obsidian opens (with a 5-second delay to let the vault index).

**Auto-sync interval** — Dropdown: disabled, every hour, every 6 hours, every 12 hours, every 24 hours. Most people will want daily or manual only.

**Command** — Always available regardless of other settings. "YouTube Transcript Sync: Sync now" in the command palette.

**Ribbon icon** — A play button in the left sidebar for one-click sync.

### Transcript

**Preferred languages** — Comma-separated language codes in priority order. Default: `en,en-US,en-GB`. yt-dlp tries them in order and takes the first available.

**Include auto-generated captions** — Toggle (default: on). When enabled, falls back to YouTube's auto-generated captions if no manual captions exist. When disabled, only manual captions are used.

**Timestamp format** — How timestamps appear in the rendered transcript. Options: per segment (every caption block gets a timestamp), every 30 seconds, every 60 seconds, or no timestamps. Default: per segment.

**Create note without transcript** — Toggle (default: on). When enabled, creates the note with metadata even if no captions are available, with `has_transcript: false` in frontmatter and a placeholder message in the transcript section. When disabled, silently skips videos without captions.

## Note template

The default template produces notes that are compatible with the Mycelium base schema (created, aliases, references, description, tags) while adding source-specific frontmatter for filtering and querying.

### Template variables

| Variable | Description | Example |
|---|---|---|
| `{{title}}` | Video title | How to Build a Space Elevator |
| `{{channel}}` | Channel name | Kurzgesagt |
| `{{channel_url}}` | Channel URL | https://youtube.com/@kurzgesagt |
| `{{url}}` | Video URL | https://youtube.com/watch?v=xxx |
| `{{video_id}}` | YouTube video ID | dQw4w9WgXcQ |
| `{{published}}` | Video publish date | 2025-03-15 |
| `{{synced}}` | Date the note was created | 2026-02-05 |
| `{{duration}}` | Video length | 12:34 |
| `{{playlist}}` | Playlist friendly name | Research Queue |
| `{{description}}` | Full video description | (raw text) |
| `{{has_transcript}}` | Whether captions were found | true / false |
| `{{transcript}}` | Formatted transcript with timestamps | [0:00] Hello everyone... |
| `{{transcript_raw}}` | Plain text transcript, no timestamps | Hello everyone... |

### Default template

```
---
created: {{synced}}
aliases:
  - {{title}}
references:
  -
description: YouTube transcript from {{channel}}
tags:
  - youtube
  - transcript
source_type: youtube-transcript
video_id: "{{video_id}}"
channel: "{{channel}}"
channel_url: "{{channel_url}}"
url: "{{url}}"
published: {{published}}
synced: {{synced}}
duration: "{{duration}}"
playlist: "{{playlist}}"
has_transcript: {{has_transcript}}
---

# {{title}}

> [!info] Source
> 📺 [Watch on YouTube]({{url}})
> 🎙️ **Channel:** [{{channel}}]({{channel_url}})
> 📅 **Published:** {{published}}
> ⏱️ **Duration:** {{duration}}

## Transcript

{{transcript}}
```

The `video_id` field in frontmatter is critical. It's the deduplication key. The sync engine checks existing notes for this field to determine what's already been synced, which means users can rename note files without causing duplicates.

## Sync engine

The sync runs as an async, non-blocking operation. The overall flow:

1. **Resolve yt-dlp.** Check the configured path or auto-detect. If not found, show an error notice and abort.
2. **Filter playlists.** Only process playlists that are enabled in settings.
3. **Ensure output folder exists.** Create it if it doesn't.
4. **Scan existing notes.** Read `video_id` from frontmatter of all markdown files in the output folder. Build a Set of known IDs.
5. **Load template.** Read from the configured vault path, or fall back to the built-in default.
6. **For each playlist:**
   - Fetch all video metadata via `yt-dlp --flat-playlist --dump-json`.
   - Filter to videos whose IDs are not in the existing set.
   - Show a notice: "📺 Playlist Name: X new video(s) found".
   - For each new video:
     - Update a persistent progress notice: "🔄 Playlist Name: 3/7 — Video Title".
     - Fetch the transcript via yt-dlp (downloads VTT to a temp directory).
     - Parse the VTT, deduplicating overlapping lines (common in auto-generated captions).
     - If no transcript and `createNoteWithoutTranscript` is off, skip.
     - Render the template with all variables.
     - Generate the filename from the format string.
     - Create the note in the vault.
     - Add the video ID to the existing set (prevents duplicates within the same sync run).
     - Sleep 1.5 seconds before the next video (rate limiting courtesy).
7. **Clean up.** Delete the temp directory used for VTT downloads.
8. **Final notice.** "✅ Sync complete: 5 new note(s), 12 already synced" or "⚠️ Sync done: 3 created, 2 error(s)".

A `isSyncing` boolean flag prevents concurrent syncs (e.g. if the interval fires while a manual sync is still running).

## VTT parsing

YouTube's auto-generated VTT files have overlapping segments where the same text appears multiple times with slightly different timestamps. The parser deduplicates by tracking seen text strings. It also strips VTT formatting tags (`<c>`, `<b>`, etc.) and HTML entities.

The output is an array of segments, each with `start` (seconds), `duration` (seconds), and `text` (clean string). The template engine then formats these according to the timestamp preference.

## Tech stack

- **Language:** TypeScript (standard Obsidian plugin)
- **Build:** esbuild (standard Obsidian plugin toolchain)
- **External dependency:** yt-dlp binary (user-installed)
- **Node APIs used:** `child_process.exec` (for yt-dlp), `fs/promises` (for temp file handling), `os.tmpdir` (for temp directory)
- **Desktop only:** due to yt-dlp binary dependency

## Risks and mitigations

**yt-dlp breakage.** YouTube changes its internals periodically. yt-dlp's maintainers are responsive but there will be windows where things break. Mitigation: the plugin handles yt-dlp errors gracefully (per-video, not per-sync), so a transcript failure doesn't block the rest of the playlist. Users should keep yt-dlp updated (`yt-dlp -U`).

**No captions available.** Some videos have no manual or auto-generated captions at all. The `createNoteWithoutTranscript` setting handles this. The note still captures metadata, which has value even without the transcript.

**Auto-generated caption quality.** YouTube's auto-captions lack punctuation and can be rough, especially for non-English content or heavy accents. A future enhancement could optionally run transcripts through an LLM for cleanup, but that's out of scope for v1.

**Large playlists.** A playlist with 500 videos would take a while on first sync (1.5s delay × 500 = 12+ minutes). The progress notice keeps the user informed. Subsequent syncs only process new additions, so this is a one-time cost.

**Filename collisions.** Two videos published on the same date with similar titles could collide. The sync engine checks for existing files before creating, and skips if a file already exists at that path. For safety, including `{{video_id}}` in the filename format eliminates this entirely, though it's ugly.

## Future considerations (out of scope for v1)

- **Re-sync / update transcripts.** A command to re-fetch transcripts for existing notes (e.g. if manual captions were added after initial sync).
- **LLM transcript cleanup.** Optional pass through Claude or another LLM to add punctuation, fix formatting, and create a summary.
- **Selective sync.** Sync only videos added after a certain date, or only the N most recent.
- **Mobile support.** Would require replacing yt-dlp with a pure JS approach (YouTube Data API + npm transcript library), adding API key configuration back into settings.
- **Obsidian URI integration.** Clickable timestamps in the transcript that open the YouTube video at that point (using `https://youtube.com/watch?v=xxx&t=123` links).

## Sources

- [yt-dlp documentation](https://github.com/yt-dlp/yt-dlp)
- [YouTube Data API v3 — PlaylistItems](https://developers.google.com/youtube/v3/docs/playlistItems)
- [youtube-transcript npm package](https://www.npmjs.com/package/youtube-transcript)
- [youtube-transcript-api (Python)](https://github.com/jdepoix/youtube-transcript-api)
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
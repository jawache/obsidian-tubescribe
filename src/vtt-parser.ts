import { TranscriptSegment, TimestampFormat } from './types';

const TAG_REGEX = /<[^>]+>/g;
const TIMESTAMP_LINE_REGEX = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;

const HTML_ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&nbsp;': ' ',
	'&#39;': "'",
	'&quot;': '"',
};

const ENTITY_REGEX = /&(?:amp|lt|gt|nbsp|#39|quot);/g;

function parseTimestamp(ts: string): number {
	const parts = ts.split(':');
	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);
	const secParts = parts[2].split('.');
	const seconds = parseInt(secParts[0], 10);
	const millis = parseInt(secParts[1], 10);
	return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function decodeEntities(text: string): string {
	return text.replace(ENTITY_REGEX, (match) => HTML_ENTITIES[match] || match);
}

function stripTags(text: string): string {
	return text.replace(TAG_REGEX, '');
}

function cleanText(text: string): string {
	return decodeEntities(stripTags(text)).trim();
}

/**
 * Parse a WebVTT string into deduplicated transcript segments.
 * Handles both YouTube auto-generated captions (rolling/overlapping cues)
 * and manual captions (unique lines per cue).
 *
 * YouTube auto-captions come in pairs:
 * 1. Content cue (long duration): line 1 = old text repeated, line 2 = new text
 * 2. Echo cue (~10ms): clean snapshot of the combined text — skip these
 *
 * For dedup: if a cue's first line matches the previous cue's last line,
 * it's a rolling repeat — drop line 1, keep the rest. This preserves all
 * content in manual captions where lines don't repeat.
 */
export function parseVTT(rawVtt: string): TranscriptSegment[] {
	const blocks = rawVtt.split(/\n\n+/);
	const segments: TranscriptSegment[] = [];
	let prevLastLine = '';

	for (const block of blocks) {
		const lines = block.trim().split('\n');

		// Find the timestamp line
		let timestampLine = -1;
		for (let i = 0; i < lines.length; i++) {
			if (TIMESTAMP_LINE_REGEX.test(lines[i])) {
				timestampLine = i;
				break;
			}
		}

		if (timestampLine === -1) continue;

		const match = lines[timestampLine].match(TIMESTAMP_LINE_REGEX);
		if (!match) continue;

		const start = parseTimestamp(match[1]);
		const end = parseTimestamp(match[2]);
		const duration = end - start;

		// Skip echo/snapshot cues (near-zero duration, ~10ms)
		if (duration <= 0.02) continue;

		let textLines = lines
			.slice(timestampLine + 1)
			.map(cleanText)
			.filter((l) => l.length > 0);

		if (textLines.length === 0) continue;

		// Rolling dedup: if the first line matches the previous cue's last line,
		// it's a repeated context line — drop it, keep only the new content.
		if (textLines.length > 1 && prevLastLine && textLines[0] === prevLastLine) {
			textLines = textLines.slice(1);
		}

		prevLastLine = textLines[textLines.length - 1];

		const text = textLines.join(' ');
		if (!text) continue;

		segments.push({ startSeconds: start, endSeconds: end, text });
	}

	return segments;
}

/**
 * Format a timestamp as [M:SS] or [H:MM:SS].
 */
function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `[${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
	}
	return `[${m}:${String(s).padStart(2, '0')}]`;
}

/**
 * Format transcript segments according to the chosen timestamp format.
 */
export function formatTranscript(
	segments: TranscriptSegment[],
	format: TimestampFormat
): string {
	if (segments.length === 0) return '';

	switch (format) {
		case 'none':
			return segments.map((s) => s.text).join('\n\n');

		case 'segment':
			return segments
				.map((s) => `${formatTime(s.startSeconds)} ${s.text}`)
				.join('\n\n');

		case '30s':
		case '60s': {
			const interval = format === '30s' ? 30 : 60;
			let lastTimestamp = -interval; // Force first timestamp
			const lines: string[] = [];

			for (const seg of segments) {
				if (seg.startSeconds - lastTimestamp >= interval) {
					lines.push(`\n${formatTime(seg.startSeconds)} ${seg.text}`);
					lastTimestamp = seg.startSeconds;
				} else {
					lines.push(seg.text);
				}
			}

			return lines.join('\n\n').trim();
		}
	}
}

/**
 * Plain text transcript with no timestamps.
 */
export function formatTranscriptRaw(segments: TranscriptSegment[]): string {
	return segments.map((s) => s.text).join(' ');
}

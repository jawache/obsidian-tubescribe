import { App } from 'obsidian';
import { TemplateVariables } from './types';

const DEFAULT_TEMPLATE = `---
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
> [Watch on YouTube]({{url}})
> **Channel:** [{{channel}}]({{channel_url}})
> **Published:** {{published}}
> **Duration:** {{duration}}

## Transcript

{{transcript}}`;

/**
 * Get the built-in default template.
 */
export function getDefaultTemplate(): string {
	return DEFAULT_TEMPLATE;
}

/**
 * Load a template from the vault, or fall back to the default.
 */
export async function loadTemplate(
	app: App,
	templatePath: string
): Promise<string> {
	if (!templatePath) {
		return DEFAULT_TEMPLATE;
	}

	try {
		const content = await app.vault.adapter.read(templatePath);
		return content;
	} catch {
		return DEFAULT_TEMPLATE;
	}
}

/**
 * Render a template by replacing all {{variable}} placeholders.
 */
export function renderTemplate(
	template: string,
	variables: TemplateVariables
): string {
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		result = result.replace(regex, value);
	}
	return result;
}

/**
 * Generate a sanitised filename from the format string and variables.
 */
export function generateFilename(
	format: string,
	variables: TemplateVariables
): string {
	let filename = renderTemplate(format, variables);

	// Replace illegal filename characters with hyphens
	filename = filename.replace(/[/\\:*?"<>|]/g, '-');

	// Collapse multiple hyphens
	filename = filename.replace(/-{2,}/g, '-');

	// Trim hyphens and whitespace from ends
	filename = filename.replace(/^[-\s]+|[-\s]+$/g, '');

	// Truncate to 200 characters
	if (filename.length > 200) {
		filename = filename.substring(0, 200);
	}

	return filename + '.md';
}

/**
 * Format a duration in seconds to MM:SS or H:MM:SS.
 */
export function formatDuration(seconds: number | null): string {
	if (seconds === null || seconds === undefined) return 'Unknown';

	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a yt-dlp date (YYYYMMDD) to YYYY-MM-DD.
 */
export function formatDate(ytDate: string | null): string {
	if (!ytDate || ytDate.length !== 8) {
		return new Date().toISOString().split('T')[0];
	}
	return `${ytDate.slice(0, 4)}-${ytDate.slice(4, 6)}-${ytDate.slice(6, 8)}`;
}

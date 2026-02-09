import { App } from 'obsidian';
import { TemplateVariables } from './types';

const DEFAULT_TEMPLATE = `---
created: {{synced}}
{{aliases_block}}references:
  -
description: {{yaml_description}}
tags:
  - youtube
  - transcript
source_type: youtube-transcript
video_id: {{yaml_video_id}}
channel: {{yaml_channel}}
channel_url: {{yaml_channel_url}}
url: {{yaml_url}}
published: {{published}}
synced: {{synced}}
duration: {{yaml_duration}}
playlist: {{yaml_playlist}}
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
 * Escape a string for safe use as a YAML value.
 * Wraps in double quotes and escapes internal quotes and backslashes.
 */
export function yamlEscape(value: string): string {
	if (!value) return '""';
	const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${escaped}"`;
}

/**
 * Clean a title: strip quotes and pipes that cause YAML/filename problems.
 */
export function sanitizeTitle(title: string): string {
	let clean = title.replace(/["'|]/g, '');
	clean = clean.replace(/\s+/g, ' ').trim();
	return clean;
}

/**
 * Sanitise a video description for use in a single-line YAML field.
 * Takes the first meaningful line, strips URLs.
 */
export function sanitizeDescription(
	description: string,
	channel: string
): string {
	if (!description) return `YouTube transcript from ${channel}`;

	const lines = description.split(/\n/);
	let firstLine = '';
	for (const line of lines) {
		const trimmed = line.trim();
		if (
			trimmed &&
			!trimmed.startsWith('http') &&
			!trimmed.startsWith('#') &&
			trimmed.length > 5
		) {
			firstLine = trimmed;
			break;
		}
	}

	if (!firstLine) return `YouTube transcript from ${channel}`;

	if (firstLine.length > 200) {
		firstLine = firstLine.substring(0, 197) + '...';
	}

	return firstLine;
}

/**
 * Build an extended set of render variables from the base TemplateVariables.
 * Adds yaml-escaped versions and the conditional aliases block.
 */
export function buildRenderVariables(
	vars: TemplateVariables
): Record<string, string> {
	const render: Record<string, string> = { ...vars };

	// Clean title for display
	render.title = sanitizeTitle(vars.title);

	// YAML-safe versions of frontmatter values
	render.yaml_video_id = yamlEscape(vars.video_id);
	render.yaml_channel = yamlEscape(vars.channel);
	render.yaml_channel_url = yamlEscape(vars.channel_url);
	render.yaml_url = yamlEscape(vars.url);
	render.yaml_duration = yamlEscape(vars.duration);
	render.yaml_playlist = yamlEscape(vars.playlist);
	render.yaml_description = yamlEscape(
		sanitizeDescription(vars.description, vars.channel)
	);

	// Aliases block: include if the title has useful content
	const cleanTitle = render.title;
	if (cleanTitle && cleanTitle.length > 0) {
		render.aliases_block = `aliases:\n  - ${yamlEscape(cleanTitle)}\n`;
	} else {
		render.aliases_block = '';
	}

	return render;
}

/**
 * Render a template by replacing all {{variable}} placeholders.
 */
export function renderTemplate(
	template: string,
	variables: Record<string, string>
): string {
	let result = template;
	// Sort keys longest-first to avoid partial replacements
	const keys = Object.keys(variables).sort((a, b) => b.length - a.length);
	for (const key of keys) {
		const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		result = result.replace(regex, variables[key]);
	}
	return result;
}

/**
 * Generate a sanitised filename from the format string and variables.
 */
export function generateFilename(
	format: string,
	variables: Record<string, string>
): string {
	let filename = renderTemplate(format, variables);

	// Strip quotes and pipes (ugly as hyphens in filenames)
	filename = filename.replace(/["'|]/g, '');

	// Replace remaining illegal filename characters with hyphens
	filename = filename.replace(/[/\\:*?<>]/g, '-');

	// Collapse multiple consecutive hyphens (but leave spaced hyphens alone)
	filename = filename.replace(/-{2,}/g, '-');

	// Collapse multiple spaces
	filename = filename.replace(/\s{2,}/g, ' ');

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

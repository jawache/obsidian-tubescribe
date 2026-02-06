import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type TubescribePlugin from './main';
import { testYtdlp, resolveYtdlpPath } from './ytdlp';

export class TubescribeSettingTab extends PluginSettingTab {
	plugin: TubescribePlugin;

	constructor(app: App, plugin: TubescribePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Connection ──────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Connection' });

		new Setting(containerEl)
			.setName('yt-dlp path')
			.setDesc('Path to the yt-dlp binary. Leave empty to auto-detect.')
			.addText((text) =>
				text
					.setPlaceholder('Auto-detect')
					.setValue(this.plugin.settings.ytdlpPath)
					.onChange(async (value) => {
						this.plugin.settings.ytdlpPath = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button.setButtonText('Test').onClick(async () => {
					try {
						const path = await resolveYtdlpPath(
							this.plugin.settings.ytdlpPath
						);
						const version = await testYtdlp(path);
						new Notice(`yt-dlp found: v${version} at ${path}`);
					} catch (e) {
						new Notice(
							`yt-dlp not found: ${e instanceof Error ? e.message : String(e)}`
						);
					}
				})
			);

		// ── Playlists ───────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Playlists' });

		const playlistContainer = containerEl.createDiv();
		this.renderPlaylists(playlistContainer);

		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Add Playlist').onClick(async () => {
				this.plugin.settings.playlists.push({
					name: '',
					url: '',
					enabled: true,
				});
				await this.plugin.saveSettings();
				this.renderPlaylists(playlistContainer);
			})
		);

		// ── Vault ───────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Vault' });

		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Where transcript notes are created.')
			.addText((text) =>
				text
					.setPlaceholder('1-chaos/external/youtube-transcripts')
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Group by playlist')
			.setDesc(
				'Create a subfolder for each playlist (e.g. output/Research Queue/).'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.groupByPlaylist)
					.onChange(async (value) => {
						this.plugin.settings.groupByPlaylist = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Note template')
			.setDesc(
				'Path to a template file in the vault. Leave empty for the built-in default.'
			)
			.addText((text) =>
				text
					.setPlaceholder('Built-in default')
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Filename format')
			.setDesc(
				'Template for note filenames. Variables: {{published}}, {{title}}, {{channel}}, {{synced}}, {{video_id}}'
			)
			.addText((text) =>
				text
					.setPlaceholder('{{published}} - {{title}}')
					.setValue(this.plugin.settings.filenameFormat)
					.onChange(async (value) => {
						this.plugin.settings.filenameFormat = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Schedule ────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Schedule' });

		new Setting(containerEl)
			.setName('Sync on startup')
			.setDesc('Run a sync automatically when Obsidian opens (5-second delay).')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.syncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Auto-sync interval')
			.setDesc('How often to automatically sync playlists.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('0', 'Disabled')
					.addOption('3600000', 'Every hour')
					.addOption('21600000', 'Every 6 hours')
					.addOption('43200000', 'Every 12 hours')
					.addOption('86400000', 'Every 24 hours')
					.setValue(String(this.plugin.settings.autoSyncInterval))
					.onChange(async (value) => {
						this.plugin.settings.autoSyncInterval = parseInt(value, 10);
						await this.plugin.saveSettings();
						this.plugin.setupAutoSync();
					})
			);

		// ── Transcript ──────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Transcript' });

		new Setting(containerEl)
			.setName('Preferred languages')
			.setDesc(
				'Comma-separated language codes in priority order (e.g. en,en-US,en-GB).'
			)
			.addText((text) =>
				text
					.setPlaceholder('en,en-US,en-GB')
					.setValue(this.plugin.settings.preferredLanguages)
					.onChange(async (value) => {
						this.plugin.settings.preferredLanguages = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Include auto-generated captions')
			.setDesc(
				'Fall back to YouTube auto-generated captions if no manual captions exist.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeAutoGenerated)
					.onChange(async (value) => {
						this.plugin.settings.includeAutoGenerated = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Timestamp format')
			.setDesc('How timestamps appear in the transcript.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('segment', 'Per segment')
					.addOption('30s', 'Every 30 seconds')
					.addOption('60s', 'Every 60 seconds')
					.addOption('none', 'No timestamps')
					.setValue(this.plugin.settings.timestampFormat)
					.onChange(async (value) => {
						this.plugin.settings.timestampFormat = value as
							| 'segment'
							| '30s'
							| '60s'
							| 'none';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Create note without transcript')
			.setDesc(
				'Create the note with metadata even if no captions are available.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.createNoteWithoutTranscript)
					.onChange(async (value) => {
						this.plugin.settings.createNoteWithoutTranscript = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderPlaylists(container: HTMLElement): void {
		container.empty();

		this.plugin.settings.playlists.forEach((playlist, index) => {
			const row = container.createDiv({ cls: 'tubescribe-playlist-row' });

			new Setting(row)
				.setName(`Playlist ${index + 1}`)
				.addText((text) =>
					text
						.setPlaceholder('Friendly name')
						.setValue(playlist.name)
						.onChange(async (value) => {
							playlist.name = value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder('YouTube playlist URL')
						.setValue(playlist.url)
						.onChange(async (value) => {
							playlist.url = value;
							await this.plugin.saveSettings();
						})
				)
				.addToggle((toggle) =>
					toggle.setValue(playlist.enabled).onChange(async (value) => {
						playlist.enabled = value;
						await this.plugin.saveSettings();
					})
				)
				.addButton((button) =>
					button
						.setIcon('trash')
						.setTooltip('Remove playlist')
						.onClick(async () => {
							this.plugin.settings.playlists.splice(index, 1);
							await this.plugin.saveSettings();
							this.renderPlaylists(container);
						})
				);
		});
	}
}

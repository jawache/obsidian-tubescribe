import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, TubescribeSettings } from './types';
import { TubescribeSettingTab } from './settings';
import { SyncEngine } from './sync';

export default class TubescribePlugin extends Plugin {
	settings: TubescribeSettings = DEFAULT_SETTINGS;
	private isSyncing = false;
	private autoSyncIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon('play-circle', 'Sync YouTube Transcripts', () => {
			this.runSync();
		});

		// Command
		this.addCommand({
			id: 'sync-now',
			name: 'Sync now',
			callback: () => this.runSync(),
		});

		// Settings tab
		this.addSettingTab(new TubescribeSettingTab(this.app, this));

		// Sync on startup
		if (this.settings.syncOnStartup) {
			this.registerEvent(
				this.app.workspace.on('layout-ready', () => {
					setTimeout(() => this.runSync(), 5000);
				})
			);
		}

		// Auto-sync interval
		this.setupAutoSync();
	}

	onunload() {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
		}
	}

	async runSync() {
		if (this.isSyncing) {
			new Notice('TubeScribe: Sync already in progress.');
			return;
		}

		this.isSyncing = true;

		try {
			const engine = new SyncEngine(this.app, this.settings);
			const result = await engine.run();

			if (result.errors > 0) {
				new Notice(
					`TubeScribe: Sync done — ${result.created} created, ${result.errors} error(s).`,
					10000
				);
			} else if (result.created > 0) {
				new Notice(
					`TubeScribe: Sync complete — ${result.created} new note(s), ${result.skipped} skipped.`,
					10000
				);
			} else {
				new Notice('TubeScribe: Everything up to date.', 5000);
			}
		} catch (e) {
			new Notice(
				`TubeScribe: Sync failed — ${e instanceof Error ? e.message : String(e)}`,
				10000
			);
			console.error('TubeScribe sync error:', e);
		} finally {
			this.isSyncing = false;
		}
	}

	setupAutoSync() {
		// Clear existing interval
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}

		if (this.settings.autoSyncInterval > 0) {
			this.autoSyncIntervalId = window.setInterval(
				() => this.runSync(),
				this.settings.autoSyncInterval
			);
			this.registerInterval(this.autoSyncIntervalId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

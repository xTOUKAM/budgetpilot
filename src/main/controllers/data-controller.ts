import { app, dialog, ipcMain } from 'electron';
import { basename, join } from 'path';
import { copyFileSync } from 'fs';
import Database from 'better-sqlite3';
import { db } from '../models/app-database';
import { today } from '../shared/financial';

const DATABASE_FILE = 'budgetpilot.sqlite';

export class DataController {
  register(): void {
    ipcMain.handle('data:backup', () => this.createBackup());
    ipcMain.handle('data:restore', () => this.restoreBackup());
    ipcMain.handle('data:export', () => this.exportTransactions());
  }

  private async createBackup() {
    const result = await dialog.showSaveDialog({
      title: 'Sauvegarder les données',
      defaultPath: join(app.getPath('documents'), `budgetpilot-${today()}.sqlite`),
      filters: [{ name: 'Base SQLite', extensions: ['sqlite'] }]
    });

    return this.copyBackup(result);
  }

  private copyBackup(result: Electron.SaveDialogReturnValue) {
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    db.pragma('wal_checkpoint(TRUNCATE)');
    copyFileSync(this.getDatabasePath(), result.filePath);
    return { canceled: false, filePath: result.filePath };
  }

  private async restoreBackup() {
    const result = await dialog.showOpenDialog({
      title: 'Restaurer une sauvegarde',
      properties: ['openFile'],
      filters: [{ name: 'Base SQLite', extensions: ['sqlite', 'db'] }]
    });

    const source = result.filePaths[0];
    if (result.canceled || !source) {
      return { canceled: true };
    }

    this.validateBackup(source);
    const current = this.getDatabasePath();
    const safetyCopy = `${current}.before-restore-${Date.now()}`;

    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    copyFileSync(current, safetyCopy);
    copyFileSync(source, current);
    app.relaunch();
    app.exit(0);

    return {
      canceled: false,
      backup: basename(safetyCopy),
      requiresRestart: true
    };
  }

  private validateBackup(source: string): void {
    const backup = new Database(source, { readonly: true });
    const result = backup
      .prepare('PRAGMA integrity_check')
      .get() as { integrity_check: string };
    backup.close();

    if (result.integrity_check !== 'ok') {
      throw new Error('La sauvegarde est corrompue.');
    }
  }

  private exportTransactions(): string {
    const rows = db.prepare(`
      SELECT
        t.date, t.type, t.amount_cents, t.category, t.note,
        a.name AS account
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      ORDER BY t.date
    `).all() as Array<Record<string, unknown>>;

    const header = [
      'date',
      'type',
      'montant_centimes',
      'categorie',
      'note',
      'compte'
    ].join(';');
    const lines = rows.map((row) =>
      [
        row.date,
        row.type,
        row.amount_cents,
        row.category,
        row.note,
        row.account
      ].map((value) => this.quoteCsvValue(value)).join(';')
    );

    return [header, ...lines].join('\r\n');
  }

  private quoteCsvValue(value: unknown): string {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  private getDatabasePath(): string {
    return join(app.getPath('userData'), 'data', DATABASE_FILE);
  }
}

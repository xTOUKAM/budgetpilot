import { app, dialog, ipcMain } from 'electron';
import { basename, join } from 'path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { safeStorage } from 'electron';
import Database from 'better-sqlite3';
import { db } from '../models/app-database';
import { today } from '../shared/financial';

const DATABASE_FILE = 'budgetpilot.sqlite';

export class DataController {
  register(): void {
    ipcMain.handle('data:backup', (_event, input: { password?: string }) => this.createBackup(input?.password));
    ipcMain.handle('data:restore', (_event, input: { password?: string }) => this.restoreBackup(input?.password));
    ipcMain.handle('data:export', (_event, input: Record<string, unknown>) =>
      this.exportTransactions(input)
    );
    ipcMain.handle('data:import-csv', (_event, input: { accountId?: number }) =>
      this.importCsv(Number(input?.accountId ?? 0))
    );
    ipcMain.handle('data:auto-backup-status', () => ({ enabled: this.isAutomaticBackupEnabled() }));
    ipcMain.handle('data:auto-backup-toggle', (_event, input: { enabled?: boolean }) =>
      this.setAutomaticBackup(Boolean(input?.enabled))
    );
  }

  startAutomaticBackup(): void {
    if (!this.isAutomaticBackupEnabled()) return;
    void this.createAutomaticBackup();
  }

  private async createBackup(password?: string) {
    const result = await dialog.showSaveDialog({
      title: 'Sauvegarder les données',
      defaultPath: join(app.getPath('documents'), `warble-${today()}.wbackup`),
      filters: [{ name: 'Sauvegarde Warble chiffrée', extensions: ['wbackup'] }]
    });

    return this.copyBackup(result, password);
  }

  private copyBackup(result: Electron.SaveDialogReturnValue, password?: string) {
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    if (!password || password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    }

    writeFileSync(result.filePath, this.encryptDatabase(password));
    return { canceled: false, filePath: result.filePath };
  }

  private async createAutomaticBackup(): Promise<void> {
    try {
      if (!safeStorage.isEncryptionAvailable()) return;
      const directory = join(app.getPath('userData'), 'backups');
      mkdirSync(directory, { recursive: true });
      const keyPath = join(directory, 'automatic-backup.key');
      let password: string;
      if (existsSync(keyPath)) {
        password = safeStorage.decryptString(readFileSync(keyPath));
      } else {
        password = randomBytes(32).toString('base64');
        writeFileSync(keyPath, safeStorage.encryptString(password));
      }
      writeFileSync(join(directory, 'automatic-latest.wbackup'), this.encryptDatabase(password));
    } catch (error) {
      console.error('Sauvegarde automatique impossible.', error);
    }
  }

  private encryptDatabase(password: string): string {
    db.pragma('wal_checkpoint(TRUNCATE)');
    const source = readFileSync(this.getDatabasePath());
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(password, salt, 32);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
    return JSON.stringify({
      version: 1, algorithm: 'aes-256-gcm',
      salt: salt.toString('base64'), iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64')
    });
  }

  private isAutomaticBackupEnabled(): boolean {
    return existsSync(this.getAutomaticBackupFlagPath());
  }

  private setAutomaticBackup(enabled: boolean) {
    if (enabled) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Le stockage sécurisé Windows est indisponible.');
      }
      mkdirSync(join(app.getPath('userData'), 'backups'), { recursive: true });
      writeFileSync(this.getAutomaticBackupFlagPath(), 'enabled');
      void this.createAutomaticBackup();
    } else if (existsSync(this.getAutomaticBackupFlagPath())) {
      unlinkSync(this.getAutomaticBackupFlagPath());
    }
    return { enabled };
  }

  private getAutomaticBackupFlagPath(): string {
    return join(app.getPath('userData'), 'backups', 'automatic-backup.enabled');
  }

  private async restoreBackup(password?: string) {
    const result = await dialog.showOpenDialog({
      title: 'Restaurer une sauvegarde',
      properties: ['openFile'],
      filters: [{ name: 'Sauvegarde Warble', extensions: ['wbackup', 'sqlite', 'db'] }]
    });

    const source = result.filePaths[0];
    if (result.canceled || !source) {
      return { canceled: true };
    }

    const restored = source.endsWith('.wbackup')
      ? this.decryptBackup(source, password)
      : undefined;
    this.validateBackup(source, restored);
    const current = this.getDatabasePath();
    const safetyCopy = `${current}.before-restore-${Date.now()}`;

    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    copyFileSync(current, safetyCopy);
    if (restored) writeFileSync(current, restored);
    else copyFileSync(source, current);
    app.relaunch();
    app.exit(0);

    return {
      canceled: false,
      backup: basename(safetyCopy),
      requiresRestart: true
    };
  }

  private validateBackup(source: string, bytes?: Buffer): void {
    let temporaryPath: string | undefined;
    if (bytes) {
      temporaryPath = join(app.getPath('temp'), `warble-validation-${Date.now()}.sqlite`);
      writeFileSync(temporaryPath, bytes);
    }
    const backup = new Database(temporaryPath ?? source, { readonly: true });
    const result = backup
      .prepare('PRAGMA integrity_check')
      .get() as { integrity_check: string };
    backup.close();
    if (temporaryPath) unlinkSync(temporaryPath);
    if (result.integrity_check !== 'ok') {
      throw new Error('La sauvegarde est corrompue.');
    }
  }

  private decryptBackup(source: string, password?: string): Buffer {
    if (!password) throw new Error('Mot de passe requis pour cette sauvegarde.');
    try {
      const payload = JSON.parse(readFileSync(source, 'utf8')) as {
        version: number; salt: string; iv: string; tag: string; data: string;
      };
      if (payload.version !== 1) throw new Error('Version de sauvegarde inconnue.');
      const key = scryptSync(password, Buffer.from(payload.salt, 'base64'), 32);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64')),
        decipher.final()
      ]);
    } catch {
      throw new Error('Mot de passe incorrect ou sauvegarde illisible.');
    }
  }

  private exportTransactions(input: Record<string, unknown>) {
    const search = String(input.search ?? '').trim().slice(0, 100);
    const from = String(input.from ?? '0000-01-01');
    const to = String(input.to ?? '9999-12-31');
    const type = String(input.type ?? '');
    const accountId = Number(input.accountId ?? 0);
    const category = String(input.category ?? '');
    const minAmount = Number(input.minAmount ?? 0);
    const maxAmount = Number(input.maxAmount ?? 0);
    const sort = input.sort === 'amount' ? 'amount' : 'date';
    const rows = db.prepare(`
      SELECT
        t.date, t.type, t.amount_cents, t.category, t.note,
        a.name AS account
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.date BETWEEN ? AND ?
        AND (? = '' OR t.note LIKE '%' || ? || '%' OR t.category LIKE '%' || ? || '%')
        AND (? = '' OR t.type = ?)
        AND (? = 0 OR t.account_id = ?)
        AND (? = '' OR t.category = ?)
        AND (? = 0 OR t.amount_cents >= ?)
        AND (? = 0 OR t.amount_cents <= ?)
      ORDER BY
        CASE WHEN ? = 'amount' THEN t.amount_cents END DESC,
        t.date DESC, t.id DESC
    `).all(
      from, to, search, search, search, type, type,
      accountId, accountId, category, category,
      minAmount, minAmount, maxAmount, maxAmount, sort
    ) as Array<Record<string, unknown>>;

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

  private async importCsv(accountId: number) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      throw new Error('Compte d’import invalide.');
    }
    const account = db.prepare('SELECT name FROM accounts WHERE id = ? AND archived = 0').get(accountId) as { name: string } | undefined;
    if (!account) throw new Error('Compte d’import introuvable.');
    const result = await dialog.showOpenDialog({
      title: 'Importer des opérations CSV',
      properties: ['openFile'],
      filters: [{ name: 'Fichier CSV', extensions: ['csv', 'txt'] }]
    });
    const source = result.filePaths[0];
    if (result.canceled || !source) return { canceled: true };

    const rows = this.parseCsv(readFileSync(source, 'utf8'));
    const operations = rows.map((row, index) => this.parseImportedRow(row, index));
    const preview = operations.slice(0, 5).map(operation =>
      `${operation.date} · ${operation.type === 'income' ? '+' : '−'}${(operation.amountCents / 100).toFixed(2)} € · ${operation.category}`
    ).join('\n');
    const duplicateCount = operations.filter(operation =>
      Boolean(db.prepare('SELECT 1 FROM transactions WHERE import_hash = ?').get(operation.hash))
    ).length;
    const confirmation = await dialog.showMessageBox({
      type: 'question',
      title: 'Confirmer l’import CSV',
      message: `${operations.length} opération(s) détectée(s) pour « ${account.name} ».`,
      detail: `${duplicateCount} doublon(s) seront ignoré(s).\n\nAperçu :\n${preview || 'Aucune ligne valide.'}`,
      buttons: ['Importer', 'Annuler'],
      defaultId: 0,
      cancelId: 1
    });
    if (confirmation.response !== 0) return { canceled: true };

    const importRows = db.transaction(() => {
      let imported = 0;
      let duplicates = 0;
      const insert = db.prepare(`
        INSERT INTO transactions
          (account_id, type, amount_cents, date, category, note, import_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const operation of operations) {
        if (db.prepare('SELECT 1 FROM transactions WHERE import_hash = ?').get(operation.hash)) {
          duplicates += 1;
          continue;
        }
        insert.run(accountId, operation.type, operation.amountCents, operation.date, operation.category, operation.note, operation.hash);
        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?')
          .run(operation.type === 'income' ? operation.amountCents : -operation.amountCents, accountId);
        imported += 1;
      }
      return { imported, duplicates };
    })();
    return { canceled: false, ...importRows };
  }

  private parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < content.length; index += 1) {
      const character = content[index];
      const next = content[index + 1];
      if (character === '"' && quoted && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (!quoted && (character === ';' || character === ',')) {
        row.push(value.trim());
        value = '';
      } else if (!quoted && (character === '\n' || character === '\r')) {
        if (character === '\r' && next === '\n') index += 1;
        row.push(value.trim());
        if (row.some(cell => cell)) rows.push(row);
        row = [];
        value = '';
      } else {
        value += character;
      }
    }
    if (value || row.length) {
      row.push(value.trim());
      if (row.some(cell => cell)) rows.push(row);
    }
    return rows;
  }

  private parseImportedRow(row: string[], index: number) {
    const date = this.normalizeImportedDate(row[0]);
    const amount = this.parseImportedAmount(row[1]);
    const category = String(row[2] ?? 'Import CSV').trim().slice(0, 60) || 'Import CSV';
    const note = String(row[3] ?? '').trim().slice(0, 300);
    const amountCents = Math.round(Math.abs(amount) * 100);
    if (!date || !Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error(`Ligne CSV ${index + 1} invalide. Format attendu : date;montant;catégorie;note`);
    }
    const type = amount < 0 ? 'expense' : 'income';
    const hash = createHash('sha256').update(`${date}|${amountCents}|${type}|${category}|${note}`).digest('hex');
    return { date, amountCents, type, category, note, hash };
  }

  private normalizeImportedDate(rawDate: string | undefined): string | null {
    const value = String(rawDate ?? '').trim();
    const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const year = iso ? Number(iso[1]) : match ? Number(match[3]) : 0;
    const month = iso ? Number(iso[2]) : match ? Number(match[2]) : 0;
    const day = iso ? Number(iso[3]) : match ? Number(match[1]) : 0;
    if (!year || !month || !day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private parseImportedAmount(rawAmount: string | undefined): number {
    let value = String(rawAmount ?? '').trim().replace(/\u00a0/g, '').replace(/\s/g, '');
    if (!value) return Number.NaN;
    const negative = value.startsWith('-') || value.startsWith('(') && value.endsWith(')');
    value = value.replace(/[()+-]/g, '');
    if (value.includes(',') && value.includes('.')) {
      value = value.lastIndexOf(',') > value.lastIndexOf('.')
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '');
    } else if (value.includes(',')) {
      value = value.replace(',', '.');
    }
    const amount = Number(value);
    return negative ? -amount : amount;
  }

  private quoteCsvValue(value: unknown): string {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  private getDatabasePath(): string {
    return join(app.getPath('userData'), 'data', DATABASE_FILE);
  }
}

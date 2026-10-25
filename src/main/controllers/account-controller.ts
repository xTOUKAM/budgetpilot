import { ipcMain } from 'electron';
import { db } from '../models/app-database';
import { ACCOUNT_TYPES, AccountType } from '../shared/financial';

interface AccountInput {
  id?: number;
  name: string;
  type: AccountType;
  openingBalanceCents?: number;
}

export class AccountController {
  register(): void {
    ipcMain.handle('accounts:create', (_event, input: Record<string, unknown>) =>
      this.createAccount(input)
    );
    ipcMain.handle('accounts:update', (_event, input: Record<string, unknown>) =>
      this.updateAccount(input)
    );
    ipcMain.handle('accounts:archive', (_event, id: unknown) =>
      this.archiveAccount(id)
    );
  }

  private createAccount(input: Record<string, unknown>) {
    const account = this.parseAccountInput(input, true);
    const result = db
      .prepare('INSERT INTO accounts (name, type, balance_cents) VALUES (?, ?, ?)')
      .run(account.name, account.type, account.openingBalanceCents);

    return {
      id: Number(result.lastInsertRowid),
      name: account.name,
      type: account.type,
      balanceCents: account.openingBalanceCents
    };
  }

  private updateAccount(input: Record<string, unknown>) {
    const account = this.parseAccountInput(input, false);
    const result = db
      .prepare('UPDATE accounts SET name = ?, type = ? WHERE id = ?')
      .run(account.name, account.type, account.id);

    if (!result.changes) {
      throw new Error('Compte introuvable.');
    }

    return { ok: true };
  }

  private archiveAccount(rawId: unknown) {
    const id = this.parsePositiveInteger(rawId, 'Compte invalide.');
    const result = db
      .prepare('UPDATE accounts SET archived = 1 WHERE id = ?')
      .run(id);

    if (!result.changes) {
      throw new Error('Compte introuvable.');
    }

    return { ok: true };
  }

  private parseAccountInput(
    input: Record<string, unknown>,
    includesOpeningBalance: boolean
  ): AccountInput {
    const name = String(input.name ?? '').trim();
    const type = String(input.type ?? 'bank');
    const openingBalanceCents = Number(input.openingBalanceCents ?? 0);

    if (!name || name.length > 80) {
      throw new Error('Le nom du compte est invalide.');
    }
    if (!ACCOUNT_TYPES.includes(type as AccountType)) {
      throw new Error('Le type de compte est invalide.');
    }
    if (
      includesOpeningBalance &&
      !Number.isSafeInteger(openingBalanceCents)
    ) {
      throw new Error('Le solde initial est invalide.');
    }

    return {
      id: Number(input.id),
      name,
      type: type as AccountType,
      openingBalanceCents
    };
  }

  private parsePositiveInteger(rawValue: unknown, message: string): number {
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(message);
    }
    return value;
  }
}

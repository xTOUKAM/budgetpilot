import { ipcMain } from 'electron';
import { db } from '../models/app-database';
import {
  isValidDate,
  isOneOf,
  transactionDelta,
  TransactionType
} from '../shared/financial';

interface TransactionInput {
  accountId: number;
  type: TransactionType;
  amountCents: number;
  date: string;
  category: string;
  note: string;
}

interface StoredTransaction {
  accountId: number;
  type: TransactionType;
  amountCents: number;
  transferGroup: string | null;
}

export class TransactionController {
  register(): void {
    ipcMain.handle('transactions:create', (_event, input: Record<string, unknown>) =>
      this.createTransaction(input)
    );
    ipcMain.handle('transactions:update', (_event, input: Record<string, unknown>) =>
      this.updateTransaction(input)
    );
    ipcMain.handle('transactions:delete', (_event, id: unknown) =>
      this.deleteTransaction(id)
    );
    ipcMain.handle('transfers:create', (_event, input: Record<string, unknown>) =>
      this.createTransfer(input)
    );
    ipcMain.handle('transfers:update', (_event, input: Record<string, unknown>) =>
      this.updateTransfer(input)
    );
  }

  private createTransaction(input: Record<string, unknown>) {
    const transaction = this.parseTransaction(input);
    this.requireActiveAccount(transaction.accountId);

    const create = db.transaction(() => {
      if (transaction.type === 'expense') {
        this.requireSufficientBalance(transaction.accountId, transaction.amountCents);
      }
      const result = db
        .prepare(`
          INSERT INTO transactions
            (account_id, type, amount_cents, date, category, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          transaction.accountId,
          transaction.type,
          transaction.amountCents,
          transaction.date,
          transaction.category,
          transaction.note
        );

      this.changeAccountBalance(
        transaction.accountId,
        transactionDelta(transaction.type, transaction.amountCents)
      );

      return Number(result.lastInsertRowid);
    });

    return { id: create(), ok: true };
  }

  private updateTransaction(input: Record<string, unknown>) {
    const id = this.requirePositiveInteger(input.id, 'Transaction invalide.');
    const replacement = this.parseTransaction(input);

    const update = db.transaction(() => {
      const previous = this.findTransaction(id);
      if (previous.transferGroup) {
        throw new Error('Un transfert doit être modifié depuis le formulaire de transfert.');
      }
      this.requireActiveAccount(replacement.accountId);
      this.changeAccountBalance(
        previous.accountId,
        -transactionDelta(previous.type, previous.amountCents)
      );

      db.prepare(`
        UPDATE transactions
        SET account_id = ?, type = ?, amount_cents = ?, date = ?,
            category = ?, note = ?
        WHERE id = ?
      `).run(
        replacement.accountId,
        replacement.type,
        replacement.amountCents,
        replacement.date,
        replacement.category,
        replacement.note,
        id
      );

      this.changeAccountBalance(
        replacement.accountId,
        transactionDelta(replacement.type, replacement.amountCents)
      );
      if (replacement.type === 'expense') {
        this.requireNonNegativeBalance(replacement.accountId);
      }
    });

    update();
    return { ok: true };
  }

  private deleteTransaction(rawId: unknown) {
    const id = this.requirePositiveInteger(rawId, 'Transaction invalide.');
    const remove = db.transaction(() => {
      const transaction = this.findTransaction(id);
      if (transaction.transferGroup) {
        const rows = db.prepare(`
          SELECT account_id AS accountId, type, amount_cents AS amountCents
          FROM transactions
          WHERE transfer_group = ?
        `).all(transaction.transferGroup) as Array<StoredTransaction>;
        db.prepare('DELETE FROM transactions WHERE transfer_group = ?').run(transaction.transferGroup);
        for (const row of rows) {
          this.changeAccountBalance(
            row.accountId,
            -transactionDelta(row.type, row.amountCents)
          );
        }
      } else {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        this.changeAccountBalance(
          transaction.accountId,
          -transactionDelta(transaction.type, transaction.amountCents)
        );
      }
    });

    remove();
    return { ok: true };
  }

  private createTransfer(input: Record<string, unknown>) {
    const transfer = this.parseTransfer(input);
    this.requireActiveAccount(transfer.fromAccountId);
    this.requireActiveAccount(transfer.toAccountId);

    const create = db.transaction(() => {
      const source = db
        .prepare('SELECT balance_cents AS balanceCents FROM accounts WHERE id = ? AND archived = 0')
        .get(transfer.fromAccountId) as { balanceCents: number } | undefined;

      if (!source || source.balanceCents < transfer.amountCents) {
        throw new Error('Solde insuffisant sur le compte source.');
      }

      const transferGroup = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const insert = db.prepare(`
        INSERT INTO transactions
          (account_id, type, amount_cents, date, category, note, transfer_group)
        VALUES (?, ?, ?, ?, 'Transfert', ?, ?)
      `);
      const outgoing = insert.run(
        transfer.fromAccountId,
        'expense',
        transfer.amountCents,
        transfer.date,
        transfer.note,
        transferGroup
      );
      insert.run(
        transfer.toAccountId,
        'income',
        transfer.amountCents,
        transfer.date,
        transfer.note,
        transferGroup
      );

      this.changeAccountBalance(transfer.fromAccountId, -transfer.amountCents);
      this.changeAccountBalance(transfer.toAccountId, transfer.amountCents);
      return Number(outgoing.lastInsertRowid);
    });

    return { id: create(), ok: true };
  }

  private updateTransfer(input: Record<string, unknown>) {
    const transferGroup = String(input.transferGroup ?? '').trim();
    if (!transferGroup || transferGroup.length > 100) {
      throw new Error('Transfert invalide.');
    }
    const transfer = this.parseTransfer(input);

    const update = db.transaction(() => {
      const previousRows = db.prepare(`
        SELECT account_id AS accountId, type, amount_cents AS amountCents
        FROM transactions
        WHERE transfer_group = ?
      `).all(transferGroup) as Array<StoredTransaction>;
      if (previousRows.length !== 2) {
        throw new Error('Transfert introuvable.');
      }

      for (const row of previousRows) {
        this.changeAccountBalance(row.accountId, -transactionDelta(row.type, row.amountCents));
      }
      db.prepare('DELETE FROM transactions WHERE transfer_group = ?').run(transferGroup);

      this.requireActiveAccount(transfer.fromAccountId);
      this.requireActiveAccount(transfer.toAccountId);
      this.requireSufficientBalance(transfer.fromAccountId, transfer.amountCents);

      const insert = db.prepare(`
        INSERT INTO transactions
          (account_id, type, amount_cents, date, category, note, transfer_group)
        VALUES (?, ?, ?, ?, 'Transfert', ?, ?)
      `);
      const outgoing = insert.run(
        transfer.fromAccountId,
        'expense',
        transfer.amountCents,
        transfer.date,
        transfer.note,
        transferGroup
      );
      insert.run(
        transfer.toAccountId,
        'income',
        transfer.amountCents,
        transfer.date,
        transfer.note,
        transferGroup
      );
      this.changeAccountBalance(transfer.fromAccountId, -transfer.amountCents);
      this.changeAccountBalance(transfer.toAccountId, transfer.amountCents);
      return Number(outgoing.lastInsertRowid);
    });

    return { id: update(), ok: true };
  }

  private parseTransaction(input: Record<string, unknown>): TransactionInput {
    const type = String(input.type);
    const transaction: TransactionInput = {
      accountId: Number(input.accountId),
      type: isOneOf(type, ['income', 'expense']) ? type : 'expense',
      amountCents: Number(input.amountCents),
      date: String(input.date),
      category: String(input.category ?? '').trim().slice(0, 60),
      note: String(input.note ?? '').trim().slice(0, 300)
    };

    const validType = isOneOf(type, ['income', 'expense']);
    if (
      !Number.isSafeInteger(transaction.accountId) ||
      !validType ||
      !Number.isSafeInteger(transaction.amountCents) ||
      transaction.amountCents <= 0 ||
      !isValidDate(transaction.date) ||
      !transaction.category
    ) {
      throw new Error('Données de transaction invalides.');
    }

    transaction.type = type as TransactionType;
    return transaction;
  }

  private parseTransfer(input: Record<string, unknown>) {
    const transfer = {
      fromAccountId: Number(input.fromAccountId),
      toAccountId: Number(input.toAccountId),
      amountCents: Number(input.amountCents),
      date: String(input.date),
      note: String(input.note ?? '').trim().slice(0, 300)
    };

    if (
      !Number.isSafeInteger(transfer.fromAccountId) ||
      !Number.isSafeInteger(transfer.toAccountId) ||
      transfer.fromAccountId === transfer.toAccountId ||
      !Number.isSafeInteger(transfer.amountCents) ||
      transfer.amountCents <= 0 ||
      !isValidDate(transfer.date)
    ) {
      throw new Error('Données de transfert invalides.');
    }

    return transfer;
  }

  private findTransaction(id: number): StoredTransaction {
    const transaction = db
      .prepare(`
        SELECT account_id AS accountId, type, amount_cents AS amountCents
          , transfer_group AS transferGroup
        FROM transactions
        WHERE id = ?
      `)
      .get(id) as StoredTransaction | undefined;

    if (!transaction) {
      throw new Error('Transaction introuvable.');
    }
    return transaction;
  }

  private requireActiveAccount(accountId: number): void {
    const account = db
      .prepare('SELECT id FROM accounts WHERE id = ? AND archived = 0')
      .get(accountId);

    if (!account) {
      throw new Error('Compte introuvable.');
    }
  }

  private changeAccountBalance(accountId: number, delta: number): void {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?')
      .run(delta, accountId);
  }

  private requireSufficientBalance(accountId: number, amountCents: number): void {
    const account = db
      .prepare('SELECT balance_cents AS balanceCents FROM accounts WHERE id = ? AND archived = 0')
      .get(accountId) as { balanceCents: number } | undefined;

    if (!account || account.balanceCents < amountCents) {
      throw new Error('Solde insuffisant sur le compte source.');
    }
  }

  private requireNonNegativeBalance(accountId: number): void {
    const account = db
      .prepare('SELECT balance_cents AS balanceCents FROM accounts WHERE id = ?')
      .get(accountId) as { balanceCents: number } | undefined;
    if (!account || account.balanceCents < 0) {
      throw new Error('Cette opération rendrait le solde du compte négatif.');
    }
  }

  private requirePositiveInteger(rawValue: unknown, message: string): number {
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(message);
    }
    return value;
  }
}

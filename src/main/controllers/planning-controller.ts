import { ipcMain } from 'electron';
import { db } from '../models/app-database';
import {
  isOneOf,
  isValidDate,
  RECURRENCE_FREQUENCIES,
  shiftDate,
  today,
  transactionDelta,
  TransactionType,
  RecurrenceFrequency
} from '../shared/financial';

interface RecurringInput {
  id: number;
  label: string;
  accountId: number;
  type: TransactionType;
  amountCents: number;
  category: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  nextDate: string;
  endDate: string | null;
}

interface DueRecurringRow {
  id: number;
  account_id: number;
  type: TransactionType;
  amount_cents: number;
  category: string;
  label: string;
  frequency: RecurrenceFrequency;
  next_date: string;
  end_date: string | null;
}

export class PlanningController {
  register(): void {
    ipcMain.handle('budgets:save', (_event, input: Record<string, unknown>) =>
      this.saveBudget(input)
    );
    ipcMain.handle('budgets:delete', (_event, id: unknown) =>
      this.deleteBudget(id)
    );
    ipcMain.handle('savings:save', (_event, input: Record<string, unknown>) =>
      this.saveSavingsGoal(input)
    );
    ipcMain.handle('categories:save', (_event, input: Record<string, unknown>) =>
      this.saveCategory(input)
    );
    ipcMain.handle('categories:archive', (_event, id: unknown) =>
      this.archiveCategory(id)
    );
    ipcMain.handle('recurring:save', (_event, input: Record<string, unknown>) =>
      this.saveRecurring(input)
    );
    ipcMain.handle('recurring:toggle', (_event, input: Record<string, unknown>) =>
      this.toggleRecurring(input)
    );
    ipcMain.handle('recurring:run-due', () => this.runDueRecurring());
  }

  private saveBudget(input: Record<string, unknown>) {
    const id = Number(input.id ?? 0);
    const category = String(input.category ?? '').trim().slice(0, 60);
    const limitCents = Number(input.limitCents);
    const month = String(input.month ?? '');

    if (
      !category.includes(' / ') ||
      !Number.isSafeInteger(limitCents) ||
      limitCents <= 0 ||
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      throw new Error('Données de budget invalides.');
    }

    if (id) {
      const result = db.prepare(`
        UPDATE budgets
        SET category = ?, limit_cents = ?, month = ?
        WHERE id = ?
      `).run(category, limitCents, month, id);
      if (result.changes === 0) throw new Error('Budget introuvable.');
    } else {
      db.prepare(`
        INSERT INTO budgets (category, limit_cents, month)
        VALUES (?, ?, ?)
        ON CONFLICT(category, month)
        DO UPDATE SET limit_cents = excluded.limit_cents
      `).run(category, limitCents, month);
    }

    return { ok: true };
  }

  private deleteBudget(rawId: unknown) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Budget invalide.');
    }
    const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    if (result.changes === 0) throw new Error('Budget introuvable.');
    return { ok: true };
  }

  private saveSavingsGoal(input: Record<string, unknown>) {
    const name = String(input.name ?? '').trim().slice(0, 80);
    const targetCents = Number(input.targetCents);
    const savedCents = Number(input.savedCents);

    if (
      !name ||
      !Number.isSafeInteger(targetCents) ||
      targetCents <= 0 ||
      !Number.isSafeInteger(savedCents) ||
      savedCents < 0
    ) {
      throw new Error("Données d'objectif invalides.");
    }

    db.prepare(`
      INSERT INTO savings_goals (name, target_cents, saved_cents)
      VALUES (?, ?, ?)
    `).run(name, targetCents, savedCents);

    return { ok: true };
  }

  private saveCategory(input: Record<string, unknown>) {
    const id = Number(input.id ?? 0);
    const name = String(input.name ?? '').trim().slice(0, 60);
    const type = String(input.type ?? '');
    const color = String(input.color ?? '#8b7cff');

    if (
      !name ||
      !isOneOf(type, ['income', 'expense']) ||
      !/^#[0-9a-f]{6}$/i.test(color)
    ) {
      throw new Error('Données de catégorie invalides.');
    }

    if (id) {
      db.prepare(`
        UPDATE categories
        SET name = ?, type = ?, color = ?, active = 1
        WHERE id = ?
      `).run(name, type, color, id);
    } else {
      db.prepare(`
        INSERT INTO categories (name, type, color)
        VALUES (?, ?, ?)
      `).run(name, type, color);
    }

    return { ok: true };
  }

  private archiveCategory(rawId: unknown) {
    const id = this.requirePositiveInteger(rawId, 'Catégorie invalide.');
    db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id);
    return { ok: true };
  }

  private saveRecurring(input: Record<string, unknown>) {
    const recurring = this.parseRecurring(input);

    if (recurring.id) {
      this.updateRecurring(recurring);
    } else {
      this.insertRecurring(recurring);
    }

    return { ok: true };
  }

  private toggleRecurring(input: Record<string, unknown>) {
    const id = this.requirePositiveInteger(input.id, 'Récurrence invalide.');
    db.prepare('UPDATE recurring_transactions SET active = ? WHERE id = ?')
      .run(input.active ? 1 : 0, id);
    return { ok: true };
  }

  private runDueRecurring() {
    const run = db.transaction(() => {
      const dueRows = this.findDueRecurring();
      const created = dueRows.reduce(
        (total, row) => total + this.processDueRecurring(row),
        0
      );
      return created;
    });

    return { created: run() };
  }

  private parseRecurring(input: Record<string, unknown>): RecurringInput {
    const type = String(input.type ?? '');
    const frequency = String(input.frequency ?? '');
    const startDate = String(input.startDate ?? today());
    const endDateValue = input.endDate ? String(input.endDate) : null;
    const recurring: RecurringInput = {
      id: Number(input.id ?? 0),
      label: String(input.label ?? '').trim().slice(0, 80),
      accountId: Number(input.accountId),
      type: isOneOf(type, ['income', 'expense']) ? type : 'expense',
      amountCents: Number(input.amountCents),
      category: String(input.category ?? '').trim().slice(0, 60),
      frequency: isOneOf(frequency, RECURRENCE_FREQUENCIES)
        ? frequency
        : 'monthly',
      startDate,
      nextDate: String(input.nextDate ?? startDate),
      endDate: endDateValue
    };

    if (
      !recurring.label ||
      !Number.isSafeInteger(recurring.accountId) ||
      !isOneOf(type, ['income', 'expense']) ||
      !Number.isSafeInteger(recurring.amountCents) ||
      recurring.amountCents <= 0 ||
      !recurring.category ||
      !isOneOf(frequency, RECURRENCE_FREQUENCIES) ||
      !isValidDate(recurring.startDate) ||
      !isValidDate(recurring.nextDate) ||
      (recurring.endDate !== null && !isValidDate(recurring.endDate))
    ) {
      throw new Error('Données de récurrence invalides.');
    }

    recurring.type = type as TransactionType;
    recurring.frequency = frequency as RecurrenceFrequency;
    return recurring;
  }

  private insertRecurring(recurring: RecurringInput): void {
    db.prepare(`
      INSERT INTO recurring_transactions
        (label, account_id, type, amount_cents, category, frequency,
         start_date, next_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recurring.label,
      recurring.accountId,
      recurring.type,
      recurring.amountCents,
      recurring.category,
      recurring.frequency,
      recurring.startDate,
      recurring.nextDate,
      recurring.endDate
    );
  }

  private updateRecurring(recurring: RecurringInput): void {
    db.prepare(`
      UPDATE recurring_transactions
      SET label = ?, account_id = ?, type = ?, amount_cents = ?,
          category = ?, frequency = ?, start_date = ?, next_date = ?,
          end_date = ?, active = 1
      WHERE id = ?
    `).run(
      recurring.label,
      recurring.accountId,
      recurring.type,
      recurring.amountCents,
      recurring.category,
      recurring.frequency,
      recurring.startDate,
      recurring.nextDate,
      recurring.endDate,
      recurring.id
    );
  }

  private findDueRecurring(): DueRecurringRow[] {
    return db.prepare(`
      SELECT *
      FROM recurring_transactions
      WHERE active = 1
        AND next_date <= ?
        AND (end_date IS NULL OR next_date <= end_date)
    `).all(today()) as DueRecurringRow[];
  }

  private processDueRecurring(row: DueRecurringRow): number {
    let dueDate = row.next_date;
    let created = 0;

    while (this.isDueDateValid(dueDate, row.end_date)) {
      if (dueDate > today()) {
        break;
      }
      if (!this.occurrenceExists(row.id, dueDate)) {
        this.createRecurringTransaction(row, dueDate);
        created += 1;
      }
      dueDate = shiftDate(dueDate, row.frequency);
    }

    db.prepare('UPDATE recurring_transactions SET next_date = ? WHERE id = ?')
      .run(dueDate, row.id);
    return created;
  }

  private occurrenceExists(recurringId: number, dueDate: string): boolean {
    return Boolean(
      db.prepare(`
        SELECT 1
        FROM recurrence_occurrences
        WHERE recurring_id = ? AND due_date = ?
      `).get(recurringId, dueDate)
    );
  }

  private createRecurringTransaction(row: DueRecurringRow, dueDate: string): void {
    const result = db.prepare(`
      INSERT INTO transactions
        (account_id, type, amount_cents, date, category, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      row.account_id,
      row.type,
      row.amount_cents,
      dueDate,
      row.category,
      `${row.label} (récurrent)`
    );

    db.prepare(`
      INSERT INTO recurrence_occurrences (recurring_id, due_date, transaction_id)
      VALUES (?, ?, ?)
    `).run(row.id, dueDate, result.lastInsertRowid);

    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?')
      .run(transactionDelta(row.type, row.amount_cents), row.account_id);
  }

  private isDueDateValid(date: string, endDate: string | null): boolean {
    return endDate === null || date <= endDate;
  }

  private requirePositiveInteger(rawValue: unknown, message: string): number {
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(message);
    }
    return value;
  }
}

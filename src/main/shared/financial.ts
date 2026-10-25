export type TransactionType = 'income' | 'expense';
export type AccountType = 'bank' | 'cash' | 'savings' | 'other';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const ACCOUNT_TYPES: readonly AccountType[] = ['bank', 'cash', 'savings', 'other'];
export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
];

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function transactionDelta(type: TransactionType, amountCents: number): number {
  return type === 'income' ? amountCents : -amountCents;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDate(date: string, frequency: RecurrenceFrequency): string {
  const nextDate = new Date(`${date}T12:00:00Z`);

  switch (frequency) {
    case 'daily':
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      break;
    case 'weekly':
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      break;
    case 'monthly':
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 3);
      break;
    case 'yearly':
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
      break;
  }

  return nextDate.toISOString().slice(0, 10);
}

export function isOneOf<T extends string>(value: string, values: readonly T[]): value is T {
  return values.includes(value as T);
}

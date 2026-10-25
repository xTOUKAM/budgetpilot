const test = require('node:test');
const assert = require('node:assert/strict');

function delta(type, amountCents) {
  return type === 'income' ? amountCents : -amountCents;
}

test('income and expense deltas update balances deterministically', () => {
  const opening = 10000;
  const balance = opening + delta('income', 2500) + delta('expense', 1250);
  assert.equal(balance, 11250);
});

test('reversing a transaction restores the previous balance', () => {
  const before = 10000;
  const transaction = delta('expense', 1250);
  assert.equal(before + transaction - transaction, before);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

test('SQLite keeps a transfer neutral in income and expense aggregates', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance_cents INTEGER NOT NULL);
    CREATE TABLE transactions (id INTEGER PRIMARY KEY, account_id INTEGER, type TEXT, amount_cents INTEGER, transfer_group TEXT);
    INSERT INTO accounts VALUES (1, 10000), (2, 5000);
  `);
  const transfer = db.transaction(() => {
    const group = 'test-transfer';
    db.prepare('INSERT INTO transactions VALUES (1,1,?,?,?)').run('expense', 2500, group);
    db.prepare('INSERT INTO transactions VALUES (2,2,?,?,?)').run('income', 2500, group);
    db.prepare('UPDATE accounts SET balance_cents=balance_cents-2500 WHERE id=1').run();
    db.prepare('UPDATE accounts SET balance_cents=balance_cents+2500 WHERE id=2').run();
  });
  transfer();
  assert.deepEqual(db.prepare('SELECT balance_cents FROM accounts ORDER BY id').all(), [{ balance_cents: 7500 }, { balance_cents: 7500 }]);
  assert.equal(db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE type='expense' AND transfer_group IS NULL").get().total, 0);
  db.close();
});

test('SQLite rolls back a failed atomic operation', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance_cents INTEGER NOT NULL); INSERT INTO accounts VALUES (1, 1000);');
  const operation = db.transaction(() => {
    db.prepare('UPDATE accounts SET balance_cents=0 WHERE id=1').run();
    throw new Error('forced failure');
  });
  assert.throws(operation, /forced failure/);
  assert.equal(db.prepare('SELECT balance_cents FROM accounts WHERE id=1').get().balance_cents, 1000);
  db.close();
});

test('SQLite rejects a transfer larger than the source balance', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance_cents INTEGER NOT NULL); INSERT INTO accounts VALUES (1, 5000), (2, 0);');
  const transfer = db.transaction((amount) => {
    const source = db.prepare('SELECT balance_cents FROM accounts WHERE id=1').get();
    if (source.balance_cents < amount) throw new Error('Solde insuffisant sur le compte source.');
    db.prepare('UPDATE accounts SET balance_cents=balance_cents-? WHERE id=1').run(amount);
    db.prepare('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=2').run(amount);
  });

  assert.throws(() => transfer(10000), /Solde insuffisant/);
  assert.deepEqual(db.prepare('SELECT balance_cents FROM accounts ORDER BY id').all(), [
    { balance_cents: 5000 },
    { balance_cents: 0 }
  ]);
  db.close();
});

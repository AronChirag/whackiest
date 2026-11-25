import bcrypt from "bcrypt";

import pool from "../src/config/db.js";

const DEMO_EMAIL = "demo@expense-copilot.test";
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_NAME = "Expense Copilot Demo";
const transactionFixtures = [
  {
    reference: "salary",
    merchant: "Demo Salary",
    amount: 80000,
    daysAgo: "monthStart",
    category: "Income",
    type: "credit",
    description: "Sample monthly salary"
  },
  {
    reference: "amazon-duplicate-a",
    merchant: "Demo Market",
    amount: 2499,
    daysAgo: 2,
    category: "Shopping",
    type: "debit",
    description: "Sample purchase for duplicate detection"
  },
  {
    reference: "amazon-duplicate-b",
    merchant: "Demo Market",
    amount: 2499,
    daysAgo: 1,
    category: "Shopping",
    type: "debit",
    description: "Sample duplicate purchase for testing"
  },
  {
    reference: "groceries",
    merchant: "Demo Groceries",
    amount: 2800,
    daysAgo: 3,
    category: "Shopping",
    type: "debit",
    description: "Sample shopping transaction"
  },
  {
    reference: "food-delivery",
    merchant: "Demo Food Delivery",
    amount: 1150,
    daysAgo: 1,
    category: "Food",
    type: "debit",
    description: "Sample food delivery"
  },
  {
    reference: "cafe",
    merchant: "Demo Cafe",
    amount: 980,
    daysAgo: 2,
    category: "Food",
    type: "debit",
    description: "Sample cafe transaction"
  },
  {
    reference: "utilities",
    merchant: "Demo Utilities",
    amount: 1800,
    daysAgo: 4,
    category: "Utilities",
    type: "debit",
    description: "Sample utility bill"
  },
  {
    reference: "transport",
    merchant: "Demo Transit",
    amount: 490,
    daysAgo: 1,
    category: "Transport",
    type: "debit",
    description: "Sample transport transaction"
  },
  {
    reference: "entertainment",
    merchant: "Demo Streaming",
    amount: 799,
    daysAgo: 5,
    category: "Entertainment",
    type: "debit",
    description: "Sample monthly streaming charge"
  }
];

async function seedDemoData() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await connection.execute(
      `INSERT INTO users (name, email, password_hash)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash)`,
      [DEMO_NAME, DEMO_EMAIL, passwordHash]
    );

    const [users] = await connection.execute(
      "SELECT id FROM users WHERE email = ?",
      [DEMO_EMAIL]
    );
    const userId = users[0]?.id;

    if (!userId) {
      throw new Error("Could not create the demo account.");
    }

    const dayOfMonth = new Date().getDate();
    for (const transaction of transactionFixtures) {
      const [existing] = await connection.execute(
        `SELECT id FROM transactions
         WHERE user_id = ? AND reference_hash = ?
         LIMIT 1`,
        [userId, `demo-fixture-v1:${transaction.reference}`]
      );

      if (existing.length) continue;

      const daysAgo = transaction.daysAgo === "monthStart"
        ? dayOfMonth - 1
        : Math.min(transaction.daysAgo, dayOfMonth - 1);
      await connection.execute(
        `INSERT INTO transactions
           (user_id, merchant, amount, transaction_date, category,
            transaction_type, description, reference_hash)
         VALUES (?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?)`,
        [
          userId,
          transaction.merchant,
          transaction.amount,
          daysAgo,
          transaction.category,
          transaction.type,
          transaction.description,
          `demo-fixture-v1:${transaction.reference}`
        ]
      );
    }

    for (const [category, monthlyLimit] of [
      ["Shopping", 5000],
      ["Food", 2000],
      ["Utilities", 2500],
      ["Entertainment", 1200]
    ]) {
      await connection.execute(
        `INSERT INTO budgets (user_id, category, monthly_limit, month_year)
         VALUES (?, ?, ?, DATE_FORMAT(CURDATE(), '%Y-%m'))
         ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)`,
        [userId, category, monthlyLimit]
      );
    }

    for (const [merchant, amount, daysUntilBilling] of [
      ["Demo Streaming Renewal", 799, 3],
      ["Demo Cloud Renewal", 249, 5]
    ]) {
      const [existing] = await connection.execute(
        "SELECT id FROM subscriptions WHERE user_id = ? AND merchant = ? LIMIT 1",
        [userId, merchant]
      );

      if (!existing.length) {
        await connection.execute(
          `INSERT INTO subscriptions
             (user_id, merchant, amount, billing_cycle,
              next_billing_date, status)
           VALUES (?, ?, ?, 'monthly',
                   DATE_ADD(CURDATE(), INTERVAL ? DAY), 'active')`,
          [userId, merchant, amount, daysUntilBilling]
        );
      }
    }

    for (const [merchant, amount, reference] of [
      ["Demo Market", 2499, "market"],
      ["Demo Cafe", 980, "cafe"]
    ]) {
      const filePath = `demo-fixture-v1:${reference}`;
      const [existing] = await connection.execute(
        "SELECT id FROM receipts WHERE user_id = ? AND file_path = ? LIMIT 1",
        [userId, filePath]
      );

      if (!existing.length) {
        await connection.execute(
          `INSERT INTO receipts
             (user_id, merchant, amount, receipt_date, file_path,
              mime_type, trust_status)
           VALUES (?, ?, ?, CURDATE(), ?, 'application/x-demo', 'untrusted')`,
          [userId, merchant, amount, filePath]
        );
      }
    }

    await connection.commit();
    console.log("Demo account and sample finance data are ready.");
    console.log(`Email: ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log("Sample data is isolated to this demo account.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedDemoData().catch((error) => {
  console.error("Could not seed demo data:", error.message);
  process.exitCode = 1;
});

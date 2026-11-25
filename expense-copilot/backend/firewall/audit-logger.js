
import crypto from "node:crypto";

function createHash(previousHash, payload) {
  return crypto
    .createHash("sha256")
    .update(`${previousHash || ""}:${payload}`)
    .digest("hex");
}

export async function logSecurityEvent(pool, {
  userId = null,
  eventType,
  eventData = {}
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [previousRows] = await connection.execute(
      `SELECT current_hash
       FROM audit_logs
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`
    );

    const previousHash = previousRows[0]?.current_hash || null;

    const safeData = JSON.stringify(eventData);
    const payload = JSON.stringify({
      userId,
      eventType,
      eventData: JSON.parse(safeData)
    });

    const currentHash = createHash(previousHash, payload);

    await connection.execute(
      `INSERT INTO audit_logs
       (user_id, event_type, event_data, previous_hash, current_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, eventType, safeData, previousHash, currentHash]
    );

    await connection.commit();

    return currentHash;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


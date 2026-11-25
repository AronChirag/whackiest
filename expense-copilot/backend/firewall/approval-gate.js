
export async function createApprovalRequest(pool, {
  userId,
  toolName,
  proposedAction,
  expiresMinutes = 10
}) {
  const expiresAt = new Date(
    Date.now() + expiresMinutes * 60 * 1000
  );

  const [result] = await pool.execute(
    `INSERT INTO approval_requests
      (user_id, tool_name, proposed_action, status, expires_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [
      userId,
      toolName,
      JSON.stringify(proposedAction),
      expiresAt
    ]
  );

  return {
    requestId: result.insertId,
    expiresAt
  };
}

export async function decideApproval(pool, {
  requestId,
  userId,
  decision
}) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new Error("Invalid approval decision.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, status, expires_at
       FROM approval_requests
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [requestId, userId]
    );

    if (!rows.length) {
      throw new Error("Approval request not found.");
    }

    const request = rows[0];

    if (request.status !== "pending") {
      throw new Error("Approval request has already been decided.");
    }

    if (new Date(request.expires_at) <= new Date()) {
      await connection.execute(
        `UPDATE approval_requests
         SET status = 'expired'
         WHERE id = ? AND user_id = ?`,
        [requestId, userId]
      );

      await connection.commit();
      return { success: false, status: "expired" };
    }

    await connection.execute(
      `UPDATE approval_requests
       SET status = ?
       WHERE id = ? AND user_id = ?`,
      [decision, requestId, userId]
    );

    await connection.commit();

    return { success: true, status: decision };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

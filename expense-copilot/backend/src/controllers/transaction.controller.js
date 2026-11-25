
import pool from "../config/db.js";

const validTypes = ["credit", "debit"];

export const addTransaction = async (req, res) => {
    try {
        const {
            merchant,
            amount,
            transaction_date,
            category,
            transaction_type,
            description
        } = req.body;

        if (
            !merchant ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            !transaction_date ||
            !category ||
            !validTypes.includes(transaction_type)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction details"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO transactions
            (
                user_id,
                merchant,
                amount,
                transaction_date,
                category,
                transaction_type,
                description
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                merchant.trim(),
                Number(amount),
                transaction_date,
                category.trim(),
                transaction_type,
                description || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Transaction added successfully",
            transactionId: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not add transaction"
        });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const {
            category,
            type,
            startDate,
            endDate,
            page = "1",
            limit = "20"
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            !Number.isInteger(pageSize) ||
            pageNumber < 1 ||
            pageSize < 1 ||
            pageSize > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination values"
            });
        }

        const conditions = ["user_id = ?"];
        const values = [req.user.id];

        if (category) {
            conditions.push("category = ?");
            values.push(category);
        }

        if (type && validTypes.includes(type)) {
            conditions.push("transaction_type = ?");
            values.push(type);
        } else if (type) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction type"
            });
        }

        if (startDate) {
            conditions.push("transaction_date >= ?");
            values.push(startDate);
        }

        if (endDate) {
            conditions.push("transaction_date <= ?");
            values.push(endDate);
        }

        const offset = (pageNumber - 1) * pageSize;

        const [transactions] = await pool.execute(
            `SELECT *
             FROM transactions
             WHERE ${conditions.join(" AND ")}
             ORDER BY transaction_date DESC, id DESC
             LIMIT ? OFFSET ?`,
            [...values, pageSize, offset]
        );

        const [count] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM transactions
             WHERE ${conditions.join(" AND ")}`,
            values
        );

        res.json({
            success: true,
            transactions,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                total: count[0].total
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not retrieve transactions"
        });
    }
};

export const updateTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            merchant,
            amount,
            transaction_date,
            category,
            transaction_type,
            description
        } = req.body;

        if (
            !merchant ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            !transaction_date ||
            !category ||
            !validTypes.includes(transaction_type)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction details"
            });
        }

        const [result] = await pool.execute(
            `UPDATE transactions
             SET merchant = ?,
                 amount = ?,
                 transaction_date = ?,
                 category = ?,
                 transaction_type = ?,
                 description = ?
             WHERE id = ? AND user_id = ?`,
            [
                merchant.trim(),
                Number(amount),
                transaction_date,
                category.trim(),
                transaction_type,
                description || null,
                id,
                req.user.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.json({
            success: true,
            message: "Transaction updated successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not update transaction"
        });
    }
};

export const deleteTransaction = async (req, res) => {
    try {
        const [result] = await pool.execute(
            `DELETE FROM transactions
             WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.json({
            success: true,
            message: "Transaction deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not delete transaction"
        });
    }
};

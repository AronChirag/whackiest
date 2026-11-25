
CREATE DATABASE IF NOT EXISTS expense_copilot;

USE expense_copilot;

-- =====================================
-- 1. USERS
-- =====================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- 2. TRANSACTIONS
-- =====================================

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    merchant VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,

    transaction_date DATE NOT NULL,

    category VARCHAR(100) NOT NULL,

    transaction_type ENUM(
        'credit',
        'debit'
    ) NOT NULL,

    description TEXT,

    reference_hash VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_transaction_user_date (
        user_id,
        transaction_date
    ),

    INDEX idx_transaction_merchant (
        user_id,
        merchant
    )
);

-- =====================================
-- 3. BUDGETS
-- =====================================

CREATE TABLE IF NOT EXISTS budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    category VARCHAR(100) NOT NULL,

    monthly_limit DECIMAL(12,2) NOT NULL,

    month_year CHAR(7) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_user_budget (
        user_id,
        category,
        month_year
    )
);

-- =====================================
-- 4. SUBSCRIPTIONS
-- =====================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    merchant VARCHAR(255) NOT NULL,

    amount DECIMAL(12,2) NOT NULL,

    billing_cycle ENUM(
        'weekly',
        'monthly',
        'quarterly',
        'yearly'
    ) DEFAULT 'monthly',

    next_billing_date DATE,

    status ENUM(
        'active',
        'cancelled',
        'paused'
    ) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =====================================
-- 5. RECEIPTS
-- =====================================

CREATE TABLE IF NOT EXISTS receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    merchant VARCHAR(255),

    amount DECIMAL(12,2),

    receipt_date DATE,

    file_path VARCHAR(500),

    mime_type VARCHAR(100),

    extracted_text TEXT,

    trust_status ENUM(
        'untrusted',
        'reviewed',
        'verified'
    ) DEFAULT 'untrusted',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =====================================
-- 6. RECEIPT MATCHES
-- =====================================

CREATE TABLE IF NOT EXISTS receipt_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,

    receipt_id INT NOT NULL,

    transaction_id INT NOT NULL,

    match_score DECIMAL(5,2),

    match_status ENUM(
        'suggested',
        'confirmed',
        'rejected'
    ) DEFAULT 'suggested',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (receipt_id)
        REFERENCES receipts(id)
        ON DELETE CASCADE,

    FOREIGN KEY (transaction_id)
        REFERENCES transactions(id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_receipt_transaction (
        receipt_id,
        transaction_id
    )
);

-- =====================================
-- 7. FIREWALL RULES
-- =====================================

CREATE TABLE IF NOT EXISTS firewall_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,

    rule_name VARCHAR(150) NOT NULL,

    tool_name VARCHAR(150),

    rule_type ENUM(
        'allow',
        'deny',
        'approval_required'
    ) NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================
-- 8. APPROVAL REQUESTS
-- =====================================

CREATE TABLE IF NOT EXISTS approval_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    tool_name VARCHAR(150) NOT NULL,

    proposed_action JSON NOT NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'executed',
        'expired'
    ) DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    expires_at TIMESTAMP NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- =====================================
-- 9. AUDIT LOGS
-- =====================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id INT,

    event_type VARCHAR(150) NOT NULL,

    event_data JSON,

    previous_hash CHAR(64),

    current_hash CHAR(64) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- =====================================
-- 10. REDACTION TOKENS
-- =====================================

CREATE TABLE IF NOT EXISTS redaction_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    token VARCHAR(100) NOT NULL,

    encrypted_value TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    UNIQUE KEY unique_user_token (
        user_id,
        token
    )
);

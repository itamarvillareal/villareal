-- Tabela de locks distribuídos do ShedLock (provider JdbcTemplate).
-- Estrutura exigida pelo ShedLock para MySQL: ver https://github.com/lukas-krecan/ShedLock
CREATE TABLE shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at TIMESTAMP(3) NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

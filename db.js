const { Pool } = require('pg');

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

db.on('error', (erro) => {
    console.error('Erro PostgreSQL:', erro);
});

module.exports = db;
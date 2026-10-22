
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada');
}

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 10000,
    keepAlive: true
});

db.on('error', erro => {
    console.error('Erro em conexão ociosa:', {
        message: erro.message,
        code: erro.code
    });
});

module.exports = db;


const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function testarConexao() {
    try {
        const connection = await db.getConnection();
        console.log('Conectado ao banco com sucesso (vamooo, vai tomaaaando)');
        connection.release();
    } catch (error) {
        console.error('Erro ao conectar ao MySQL:', error.message);
    }
}

testarConexao();

module.exports = db;
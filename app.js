const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = 3000;
const db = require('./db');

app.use(express.json());

app.get('./produtos', (req, res) => {
    db.query('SELECT * FROM produtos', (err, results) => {
        if (err) {
            res.status(500).send('Erro ao buscar dados do banco :P');
        } else {
            res.json(results);
        }
    });
});

app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port} (vamooooooooooooo)`);
});

app.use((req, res, next) => {
    const error = new Error('Rota não encontrada (bleh)');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500).json({ erro: error.message });
});

module.exports = app;
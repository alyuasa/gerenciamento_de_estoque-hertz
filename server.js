require('dotenv').config();

const express = require('express');
const db = require('./db');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());

app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ]
}));

const idValido = id =>
    /^[1-9]\d*$/.test(String(id));

const quantidadeValida = qtd =>
    Number.isSafeInteger(qtd) && qtd > 0;

const tipoValido = tipo =>
    tipo === 'entrada' || tipo === 'saida';

const efeito = (tipo, qtd) =>
    tipo === 'entrada' ? qtd : -qtd;

function erro(res, error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro interno no servidor' });
}

// =========================
// CRUD DE PRODUTOS
// =========================

// GET - Listar produtos
app.get('/produtos', async (req, res) => {
    try {
        const [produtos] = await db.query('SELECT * FROM produtos');
        res.json(produtos);
    } catch (error) {
        erro(res, error);
    }
});

// GET - Buscar produto por ID
app.get('/produtos/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    try {
        const [produtos] = await db.query(
            'SELECT * FROM produtos WHERE id_produto = ?',
            [req.params.id]
        );

        if (!produtos.length)
            return res.status(404).json({ erro: 'Produto não encontrado' });

        res.json(produtos[0]);
    } catch (error) {
        erro(res, error);
    }
});

// POST - Cadastrar produto
app.post('/produtos', async (req, res) => {
    const { nome, categoria, quantidade, valor } = req.body;

    if (
        typeof nome !== 'string' || !nome.trim() ||
        typeof categoria !== 'string' || !categoria.trim() ||
        !Number.isSafeInteger(quantidade) || quantidade < 0 ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) || valor < 0
    ) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    try {
        const [resultado] = await db.query(
            `INSERT INTO produtos (nome, categoria, quantidade, valor)
             VALUES (?, ?, ?, ?)`,
            [nome.trim(), categoria.trim(), quantidade, valor]
        );

        res.status(201).json({
            mensagem: 'Produto cadastrado',
            id_produto: resultado.insertId
        });
    } catch (error) {
        erro(res, error);
    }
});

// PUT - Atualizar produto
app.put('/produtos/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    const { nome, categoria, valor } = req.body;

    if (
        typeof nome !== 'string' || !nome.trim() ||
        typeof categoria !== 'string' || !categoria.trim() ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) || valor < 0
    ) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    try {
        const [resultado] = await db.query(
            `UPDATE produtos SET nome = ?, categoria = ?, valor = ?
             WHERE id_produto = ?`,
            [nome.trim(), categoria.trim(), valor, req.params.id]
        );

        if (!resultado.affectedRows)
            return res.status(404).json({ erro: 'Produto não encontrado' });

        res.json({ mensagem: 'Produto atualizado' });
    } catch (error) {
        erro(res, error);
    }
});

// DELETE - Excluir produto
app.delete('/produtos/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    try {
        const [resultado] = await db.query(
            'DELETE FROM produtos WHERE id_produto = ?',
            [req.params.id]
        );

        if (!resultado.affectedRows)
            return res.status(404).json({ erro: 'Produto não encontrado' });

        res.json({ mensagem: 'Produto excluído' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2')
            return res.status(409).json({
                erro: 'Produto possui movimentações vinculadas'
            });

        erro(res, error);
    }
});

// =========================
// CRUD DE MOVIMENTAÇÕES
// =========================

// GET - Listar movimentações
app.get('/movimentacoes', async (req, res) => {
    try {
        const [movimentacoes] = await db.query(
            'SELECT * FROM movimentacoes ORDER BY data DESC'
        );
        res.json(movimentacoes);
    } catch (error) {
        erro(res, error);
    }
});

// GET - Buscar movimentação por ID
app.get('/movimentacoes/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    try {
        const [dados] = await db.query(
            'SELECT * FROM movimentacoes WHERE id_movimentacao = ?',
            [req.params.id]
        );

        if (!dados.length)
            return res.status(404).json({ erro: 'Movimentação não encontrada' });

        res.json(dados[0]);
    } catch (error) {
        erro(res, error);
    }
});

// POST - Registrar entrada ou saída
app.post('/movimentacoes', async (req, res) => {
    const { produtos_id_produto, tipo, qtd_movimentada } = req.body;

    if (
        !idValido(produtos_id_produto) ||
        !tipoValido(tipo) ||
        !quantidadeValida(qtd_movimentada)
    ) {
        return res.status(400).json({ erro: 'Dados inválidos' });
    }

    const conexao = await db.getConnection();

    try {
        await conexao.beginTransaction();

        const [produtos] = await conexao.query(
            'SELECT quantidade FROM produtos WHERE id_produto = ? FOR UPDATE',
            [produtos_id_produto]
        );

        if (!produtos.length) {
            await conexao.rollback();
            return res.status(404).json({ erro: 'Produto não encontrado' });
        }

        const novaQtd = produtos[0].quantidade +
            efeito(tipo, qtd_movimentada);

        if (novaQtd < 0) {
            await conexao.rollback();
            return res.status(400).json({ erro: 'Estoque insuficiente' });
        }

        await conexao.query(
            'UPDATE produtos SET quantidade = ? WHERE id_produto = ?',
            [novaQtd, produtos_id_produto]
        );

        const [resultado] = await conexao.query(
            `INSERT INTO movimentacoes
             (data, tipo, qtd_movimentada, produtos_id_produto)
             VALUES (NOW(), ?, ?, ?)`,
            [tipo, qtd_movimentada, produtos_id_produto]
        );

        await conexao.commit();

        res.status(201).json({
            mensagem: 'Movimentação registrada',
            id_movimentacao: resultado.insertId,
            estoque_atual: novaQtd
        });
    } catch (error) {
        await conexao.rollback();
        erro(res, error);
    } finally {
        conexao.release();
    }
});

// PUT - Corrigir movimentação
app.put('/movimentacoes/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    const { tipo, qtd_movimentada } = req.body;

    if (!tipoValido(tipo) || !quantidadeValida(qtd_movimentada))
        return res.status(400).json({ erro: 'Dados inválidos' });

    const conexao = await db.getConnection();

    try {
        await conexao.beginTransaction();

        const [dados] = await conexao.query(
            'SELECT * FROM movimentacoes WHERE id_movimentacao = ? FOR UPDATE',
            [req.params.id]
        );

        if (!dados.length) {
            await conexao.rollback();
            return res.status(404).json({ erro: 'Movimentação não encontrada' });
        }

        const antiga = dados[0];

        const [produtos] = await conexao.query(
            'SELECT quantidade FROM produtos WHERE id_produto = ? FOR UPDATE',
            [antiga.produtos_id_produto]
        );

        const novaQtd = produtos[0].quantidade
            - efeito(antiga.tipo, Number(antiga.qtd_movimentada))
            + efeito(tipo, qtd_movimentada);

        if (novaQtd < 0) {
            await conexao.rollback();
            return res.status(400).json({ erro: 'Estoque insuficiente' });
        }

        await conexao.query(
            'UPDATE produtos SET quantidade = ? WHERE id_produto = ?',
            [novaQtd, antiga.produtos_id_produto]
        );

        await conexao.query(
            `UPDATE movimentacoes SET tipo = ?, qtd_movimentada = ?
             WHERE id_movimentacao = ?`,
            [tipo, qtd_movimentada, req.params.id]
        );

        await conexao.commit();

        res.json({
            mensagem: 'Movimentação atualizada',
            estoque_atual: novaQtd
        });
    } catch (error) {
        await conexao.rollback();
        erro(res, error);
    } finally {
        conexao.release();
    }
});

// DELETE - Excluir movimentação
app.delete('/movimentacoes/:id', async (req, res) => {
    if (!idValido(req.params.id))
        return res.status(400).json({ erro: 'ID inválido' });

    const conexao = await db.getConnection();

    try {
        await conexao.beginTransaction();

        const [dados] = await conexao.query(
            'SELECT * FROM movimentacoes WHERE id_movimentacao = ? FOR UPDATE',
            [req.params.id]
        );

        if (!dados.length) {
            await conexao.rollback();
            return res.status(404).json({ erro: 'Movimentação não encontrada' });
        }

        const mov = dados[0];

        const [produtos] = await conexao.query(
            'SELECT quantidade FROM produtos WHERE id_produto = ? FOR UPDATE',
            [mov.produtos_id_produto]
        );

        const novaQtd = produtos[0].quantidade -
            efeito(mov.tipo, Number(mov.qtd_movimentada));

        if (novaQtd < 0) {
            await conexao.rollback();
            return res.status(400).json({
                erro: 'Não é possível reverter esta movimentação'
            });
        }

        await conexao.query(
            'UPDATE produtos SET quantidade = ? WHERE id_produto = ?',
            [novaQtd, mov.produtos_id_produto]
        );

        await conexao.query(
            'DELETE FROM movimentacoes WHERE id_movimentacao = ?',
            [req.params.id]
        );

        await conexao.commit();

        res.json({
            mensagem: 'Movimentação excluída',
            estoque_atual: novaQtd
        });
    } catch (error) {
        await conexao.rollback();
        erro(res, error);
    } finally {
        conexao.release();
    }
});

// Rota não encontrada
app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});


app.listen(port, () => {
    console.log(`API rodando (yees)`);
});

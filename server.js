
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURAÇÕES
// ==========================================

app.use(express.json());

const origensPermitidas = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: origensPermitidas
}));

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

class ErroHTTP extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

function idValido(id) {
    return /^[1-9]\d*$/.test(String(id)) &&
        Number.isSafeInteger(Number(id)) &&
        Number(id) <= 2147483647;
}

function quantidadeValida(quantidade) {
    return Number.isSafeInteger(quantidade) &&
        quantidade > 0 &&
        quantidade <= 2147483647;
}

function tipoValido(tipo) {
    return tipo === 'entrada' || tipo === 'saida';
}

function calcularEfeito(tipo, quantidade) {
    return tipo === 'entrada'
        ? quantidade
        : -quantidade;
}

function validarProduto(dados, cadastro = false) {
    const { nome, categoria, quantidade, valor } = dados;

    if (
        typeof nome !== 'string' ||
        !nome.trim() ||
        nome.trim().length > 255 ||
        typeof categoria !== 'string' ||
        !categoria.trim() ||
        categoria.trim().length > 255 ||
        typeof valor !== 'number' ||
        !Number.isFinite(valor) ||
        valor < 0 ||
        valor > 99999999.99 ||
        Math.abs(valor * 100 - Math.round(valor * 100)) >= 0.000001
    ) {
        return false;
    }

    if (cadastro) {
        return Number.isSafeInteger(quantidade) &&
            quantidade >= 0 &&
            quantidade <= 2147483647;
    }

    return true;
}

function validarEstoque(quantidade) {
    if (
        !Number.isSafeInteger(quantidade) ||
        quantidade < 0 ||
        quantidade > 2147483647
    ) {
        throw new ErroHTTP(
            400,
            'Movimentação resultaria em estoque inválido'
        );
    }
}

function tratarErro(res, erro) {
    if (erro instanceof ErroHTTP) {
        return res.status(erro.status).json({
            erro: erro.message
        });
    }

    console.error('Erro na Hertz API:', erro);

    if (erro.code === '23503') {
        return res.status(409).json({
            erro: 'Registro possui dados vinculados'
        });
    }

    if (erro.code === '23505') {
        return res.status(409).json({
            erro: 'Registro duplicado'
        });
    }

    if (
        erro.code === '23514' ||
        erro.code === '23502' ||
        erro.code === '22P02'
    ) {
        return res.status(400).json({
            erro: 'Dados inválidos para o banco de dados'
        });
    }

    return res.status(500).json({
        erro: 'Erro interno no servidor'
    });
}

// ==========================================
// TRANSAÇÕES POSTGRESQL
// ==========================================

async function executarTransacao(operacao) {
    const cliente = await db.connect();

    try {
        await cliente.query('BEGIN');

        const resultado = await operacao(cliente);

        await cliente.query('COMMIT');

        return resultado;

    } catch (erro) {
        try {
            await cliente.query('ROLLBACK');
        } catch (erroRollback) {
            console.error('Erro ao reverter transação:', erroRollback);
        }

        throw erro;

    } finally {
        cliente.release();
    }
}

// Wrapper para rotas assíncronas
function executar(funcao) {
    return async (req, res, next) => {
        try {
            await funcao(req, res);
        } catch (erro) {
            next(erro);
        }
    };
}

// ==========================================
// STATUS DA API
// ==========================================

app.get('/', (req, res) => {
    res.status(200).json({
        sistema: 'Hertz Music & Audio Store',
        api: 'Gerenciamento de estoque',
        status: 'online',
        banco: 'PostgreSQL'
    });
});

// Testar servidor
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        sistema: 'Hertz API'
    });
});

// Testar conexão com Neon
app.get('/health/db', executar(async (req, res) => {
    await db.query('SELECT 1');

    res.status(200).json({
        status: 'conectado',
        banco: 'PostgreSQL'
    });
}));

// ==========================================
// CRUD DE PRODUTOS
// ==========================================

// GET - Listar todos
app.get('/produtos', executar(async (req, res) => {
    const resultado = await db.query(
        'SELECT * FROM produtos ORDER BY nome ASC'
    );

    res.status(200).json(resultado.rows);
}));

// GET - Buscar produto por ID
app.get('/produtos/:id', executar(async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        throw new ErroHTTP(400, 'ID inválido');
    }

    const resultado = await db.query(
        'SELECT * FROM produtos WHERE id_produto = $1',
        [id]
    );

    if (resultado.rows.length === 0) {
        throw new ErroHTTP(404, 'Produto não encontrado');
    }

    res.status(200).json(resultado.rows[0]);
}));

// POST - Cadastrar produto
app.post('/produtos', executar(async (req, res) => {
    const dados = req.body || {};

    if (!validarProduto(dados, true)) {
        throw new ErroHTTP(400, 'Dados do produto inválidos');
    }

    const { nome, categoria, quantidade, valor } = dados;

    const resultado = await db.query(
        `INSERT INTO produtos
         (nome, categoria, quantidade, valor)
         VALUES ($1, $2, $3, $4)
         RETURNING id_produto`,
        [
            nome.trim(),
            categoria.trim(),
            quantidade,
            valor
        ]
    );

    res.status(201).json({
        mensagem: 'Produto cadastrado com sucesso',
        id_produto: resultado.rows[0].id_produto
    });
}));

// PUT - Atualizar produto
app.put('/produtos/:id', executar(async (req, res) => {
    const { id } = req.params;
    const dados = req.body || {};

    if (!idValido(id)) {
        throw new ErroHTTP(400, 'ID inválido');
    }

    if (!validarProduto(dados)) {
        throw new ErroHTTP(400, 'Dados do produto inválidos');
    }

    const { nome, categoria, valor } = dados;

    const resultado = await db.query(
        `UPDATE produtos
         SET nome = $1,
             categoria = $2,
             valor = $3
         WHERE id_produto = $4`,
        [
            nome.trim(),
            categoria.trim(),
            valor,
            id
        ]
    );

    if (resultado.rowCount === 0) {
        throw new ErroHTTP(404, 'Produto não encontrado');
    }

    res.status(200).json({
        mensagem: 'Produto atualizado com sucesso'
    });
}));

// DELETE - Excluir produto
app.delete('/produtos/:id', executar(async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        throw new ErroHTTP(400, 'ID inválido');
    }

    const resultado = await db.query(
        'DELETE FROM produtos WHERE id_produto = $1',
        [id]
    );

    if (resultado.rowCount === 0) {
        throw new ErroHTTP(404, 'Produto não encontrado');
    }

    res.status(200).json({
        mensagem: 'Produto excluído com sucesso'
    });
}));

// ==========================================
// CRUD DE MOVIMENTAÇÕES
// ==========================================

// GET - Listar movimentações
app.get('/movimentacoes', executar(async (req, res) => {
    const resultado = await db.query(
        `SELECT *
         FROM movimentacoes
         ORDER BY data DESC, id_movimentacao DESC`
    );

    res.status(200).json(resultado.rows);
}));

// GET - Buscar movimentação por ID
app.get('/movimentacoes/:id', executar(async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        throw new ErroHTTP(400, 'ID inválido');
    }

    const resultado = await db.query(
        `SELECT *
         FROM movimentacoes
         WHERE id_movimentacao = $1`,
        [id]
    );

    if (resultado.rows.length === 0) {
        throw new ErroHTTP(404, 'Movimentação não encontrada');
    }

    res.status(200).json(resultado.rows[0]);
}));

// POST - Registrar entrada ou saída
app.post('/movimentacoes', executar(async (req, res) => {
    const {
        produtos_id_produto,
        tipo,
        qtd_movimentada
    } = req.body || {};

    if (
        !idValido(produtos_id_produto) ||
        !tipoValido(tipo) ||
        !quantidadeValida(qtd_movimentada)
    ) {
        throw new ErroHTTP(
            400,
            'Dados da movimentação inválidos'
        );
    }

    const resposta = await executarTransacao(async cliente => {
        const consulta = await cliente.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = $1
             FOR UPDATE`,
            [produtos_id_produto]
        );

        if (consulta.rows.length === 0) {
            throw new ErroHTTP(404, 'Produto não encontrado');
        }

        const estoqueAtual = consulta.rows[0].quantidade;

        const novoEstoque = estoqueAtual +
            calcularEfeito(tipo, qtd_movimentada);

        validarEstoque(novoEstoque);

        await cliente.query(
            `UPDATE produtos
             SET quantidade = $1
             WHERE id_produto = $2`,
            [novoEstoque, produtos_id_produto]
        );

        const movimento = await cliente.query(
            `INSERT INTO movimentacoes
             (data, tipo, qtd_movimentada, produtos_id_produto)
             VALUES (CURRENT_TIMESTAMP, $1, $2, $3)
             RETURNING id_movimentacao`,
            [
                tipo,
                qtd_movimentada,
                produtos_id_produto
            ]
        );

        return {
            mensagem: 'Movimentação registrada com sucesso',
            id_movimentacao: movimento.rows[0].id_movimentacao,
            estoque_atual: novoEstoque
        };
    });

    res.status(201).json(resposta);
}));

// PUT - Atualizar movimentação
app.put('/movimentacoes/:id', executar(async (req, res) => {
    const { id } = req.params;
    const { tipo, qtd_movimentada } = req.body || {};

    if (
        !idValido(id) ||
        !tipoValido(tipo) ||
        !quantidadeValida(qtd_movimentada)
    ) {
        throw new ErroHTTP(
            400,
            'Dados da movimentação inválidos'
        );
    }

    const resposta = await executarTransacao(async cliente => {
        const consulta = await cliente.query(
            `SELECT *
             FROM movimentacoes
             WHERE id_movimentacao = $1
             FOR UPDATE`,
            [id]
        );

        if (consulta.rows.length === 0) {
            throw new ErroHTTP(
                404,
                'Movimentação não encontrada'
            );
        }

        const anterior = consulta.rows[0];

        const produto = await cliente.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = $1
             FOR UPDATE`,
            [anterior.produtos_id_produto]
        );

        if (produto.rows.length === 0) {
            throw new ErroHTTP(
                404,
                'Produto vinculado não encontrado'
            );
        }

        // Reverte a movimentação anterior
        const efeitoAnterior = calcularEfeito(
            anterior.tipo,
            anterior.qtd_movimentada
        );

        // Aplica a nova movimentação
        const efeitoNovo = calcularEfeito(
            tipo,
            qtd_movimentada
        );

        const novoEstoque =
            produto.rows[0].quantidade -
            efeitoAnterior +
            efeitoNovo;

        validarEstoque(novoEstoque);

        await cliente.query(
            `UPDATE produtos
             SET quantidade = $1
             WHERE id_produto = $2`,
            [novoEstoque, anterior.produtos_id_produto]
        );

        await cliente.query(
            `UPDATE movimentacoes
             SET tipo = $1,
                 qtd_movimentada = $2
             WHERE id_movimentacao = $3`,
            [tipo, qtd_movimentada, id]
        );

        return {
            mensagem: 'Movimentação atualizada com sucesso',
            estoque_atual: novoEstoque
        };
    });

    res.status(200).json(resposta);
}));

// DELETE - Excluir movimentação
app.delete('/movimentacoes/:id', executar(async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        throw new ErroHTTP(400, 'ID inválido');
    }

    const resposta = await executarTransacao(async cliente => {
        const consulta = await cliente.query(
            `SELECT *
             FROM movimentacoes
             WHERE id_movimentacao = $1
             FOR UPDATE`,
            [id]
        );

        if (consulta.rows.length === 0) {
            throw new ErroHTTP(
                404,
                'Movimentação não encontrada'
            );
        }

        const movimento = consulta.rows[0];

        const produto = await cliente.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = $1
             FOR UPDATE`,
            [movimento.produtos_id_produto]
        );

        if (produto.rows.length === 0) {
            throw new ErroHTTP(
                404,
                'Produto vinculado não encontrado'
            );
        }

        // Desfaz o efeito no estoque
        const efeitoAnterior = calcularEfeito(
            movimento.tipo,
            movimento.qtd_movimentada
        );

        const novoEstoque =
            produto.rows[0].quantidade -
            efeitoAnterior;

        validarEstoque(novoEstoque);

        await cliente.query(
            `UPDATE produtos
             SET quantidade = $1
             WHERE id_produto = $2`,
            [novoEstoque, movimento.produtos_id_produto]
        );

        await cliente.query(
            `DELETE FROM movimentacoes
             WHERE id_movimentacao = $1`,
            [id]
        );

        return {
            mensagem: 'Movimentação excluída com sucesso',
            estoque_atual: novoEstoque
        };
    });

    res.status(200).json(resposta);
}));

// ==========================================
// TRATAMENTO DE ERROS
// ==========================================

// Erros de JSON
app.use((erro, req, res, next) => {
    if (
        erro instanceof SyntaxError &&
        erro.status === 400 &&
        'body' in erro
    ) {
        return res.status(400).json({
            erro: 'JSON inválido'
        });
    }

    next(erro);
});

// Rota não encontrada
app.use((req, res) => {
    res.status(404).json({
        erro: 'Rota não encontrada'
    });
});

// Erros internos
app.use((erro, req, res, next) => {
    tratarErro(res, erro);
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

// Execução local
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Hertz API rodando na porta ${PORT}`);
    });
}

// Exportação para a Vercel
module.exports = app;

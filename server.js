
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================
// CONFIGURAÇÕES
// =====================================

app.use(express.json());

const origensPermitidas = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: origensPermitidas
}));

// =====================================
// FUNÇÕES AUXILIARES
// =====================================

function idValido(id) {
    return /^[1-9]\d*$/.test(String(id));
}

function quantidadeValida(quantidade) {
    return Number.isSafeInteger(quantidade) && quantidade > 0;
}

function tipoValido(tipo) {
    return tipo === 'entrada' || tipo === 'saida';
}

function calcularEfeito(tipo, quantidade) {
    return tipo === 'entrada' ? quantidade : -quantidade;
}

function tratarErro(res, error) {
    console.error('Erro na API:', error);

    if (
        error.code === 'ER_ROW_IS_REFERENCED_2' ||
        error.code === 'ER_ROW_IS_REFERENCED'
    ) {
        return res.status(409).json({
            erro: 'Registro possui dados vinculados'
        });
    }

    if (
        error.code === 'ER_NO_REFERENCED_ROW_2' ||
        error.code === 'ER_NO_REFERENCED_ROW'
    ) {
        return res.status(400).json({
            erro: 'Produto relacionado não existe'
        });
    }

    res.status(500).json({
        erro: 'Erro interno no servidor'
    });
}

function validarProduto(dados, cadastro = false) {
    const { nome, categoria, valor, quantidade } = dados;

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
        valor > 99999999.99
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

// =====================================
// STATUS DA API
// =====================================

app.get('/', (req, res) => {
    res.json({
        sistema: 'Hertz Music & Audio Store',
        api: 'Gerenciamento de estoque',
        status: 'online'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        sistema: 'Hertz API'
    });
});

// =====================================
// CRUD DE PRODUTOS
// =====================================

// GET - Listar todos os produtos
app.get('/produtos', async (req, res) => {
    try {
        const [produtos] = await db.query(
            'SELECT * FROM produtos ORDER BY nome ASC'
        );

        res.status(200).json(produtos);

    } catch (error) {
        tratarErro(res, error);
    }
});

// GET - Buscar produto por ID
app.get('/produtos/:id', async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        return res.status(400).json({
            erro: 'ID inválido'
        });
    }

    try {
        const [produtos] = await db.query(
            'SELECT * FROM produtos WHERE id_produto = ?',
            [id]
        );

        if (!produtos.length) {
            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        res.status(200).json(produtos[0]);

    } catch (error) {
        tratarErro(res, error);
    }
});

// POST - Cadastrar produto
app.post('/produtos', async (req, res) => {
    const dados = req.body || {};

    if (!validarProduto(dados, true)) {
        return res.status(400).json({
            erro: 'Dados do produto inválidos'
        });
    }

    const { nome, categoria, quantidade, valor } = dados;

    try {
        const [resultado] = await db.query(
            `INSERT INTO produtos
             (nome, categoria, quantidade, valor)
             VALUES (?, ?, ?, ?)`,
            [nome.trim(), categoria.trim(), quantidade, valor]
        );

        res.status(201).json({
            mensagem: 'Produto cadastrado com sucesso',
            id_produto: resultado.insertId
        });

    } catch (error) {
        tratarErro(res, error);
    }
});

// PUT - Atualizar produto
app.put('/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const dados = req.body || {};

    if (!idValido(id)) {
        return res.status(400).json({
            erro: 'ID inválido'
        });
    }

    if (!validarProduto(dados)) {
        return res.status(400).json({
            erro: 'Dados do produto inválidos'
        });
    }

    const { nome, categoria, valor } = dados;

    try {
        const [resultado] = await db.query(
            `UPDATE produtos
             SET nome = ?, categoria = ?, valor = ?
             WHERE id_produto = ?`,
            [nome.trim(), categoria.trim(), valor, id]
        );

        if (!resultado.affectedRows) {
            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        res.status(200).json({
            mensagem: 'Produto atualizado com sucesso'
        });

    } catch (error) {
        tratarErro(res, error);
    }
});

// DELETE - Excluir produto
app.delete('/produtos/:id', async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        return res.status(400).json({
            erro: 'ID inválido'
        });
    }

    try {
        const [resultado] = await db.query(
            'DELETE FROM produtos WHERE id_produto = ?',
            [id]
        );

        if (!resultado.affectedRows) {
            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        res.status(200).json({
            mensagem: 'Produto excluído com sucesso'
        });

    } catch (error) {
        tratarErro(res, error);
    }
});

// =====================================
// CRUD DE MOVIMENTAÇÕES
// =====================================

// GET - Listar movimentações
app.get('/movimentacoes', async (req, res) => {
    try {
        const [movimentacoes] = await db.query(
            `SELECT *
             FROM movimentacoes
             ORDER BY data DESC, id_movimentacao DESC`
        );

        res.status(200).json(movimentacoes);

    } catch (error) {
        tratarErro(res, error);
    }
});

// GET - Buscar movimentação por ID
app.get('/movimentacoes/:id', async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        return res.status(400).json({
            erro: 'ID inválido'
        });
    }

    try {
        const [movimentacoes] = await db.query(
            `SELECT *
             FROM movimentacoes
             WHERE id_movimentacao = ?`,
            [id]
        );

        if (!movimentacoes.length) {
            return res.status(404).json({
                erro: 'Movimentação não encontrada'
            });
        }

        res.status(200).json(movimentacoes[0]);

    } catch (error) {
        tratarErro(res, error);
    }
});

// POST - Registrar movimentação
app.post('/movimentacoes', async (req, res) => {
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
        return res.status(400).json({
            erro: 'Dados da movimentação inválidos'
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [produtos] = await conexao.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = ?
             FOR UPDATE`,
            [produtos_id_produto]
        );

        if (!produtos.length) {
            await conexao.rollback();

            return res.status(404).json({
                erro: 'Produto não encontrado'
            });
        }

        const estoqueAtual = Number(produtos[0].quantidade);

        const novoEstoque = estoqueAtual +
            calcularEfeito(tipo, qtd_movimentada);

        if (novoEstoque < 0) {
            await conexao.rollback();

            return res.status(400).json({
                erro: 'Estoque insuficiente'
            });
        }

        if (novoEstoque > 2147483647) {
            await conexao.rollback();

            return res.status(400).json({
                erro: 'Quantidade acima do limite permitido'
            });
        }

        await conexao.query(
            `UPDATE produtos
             SET quantidade = ?
             WHERE id_produto = ?`,
            [novoEstoque, produtos_id_produto]
        );

        const [resultado] = await conexao.query(
            `INSERT INTO movimentacoes
             (data, tipo, qtd_movimentada, produtos_id_produto)
             VALUES (NOW(), ?, ?, ?)`,
            [tipo, qtd_movimentada, produtos_id_produto]
        );

        await conexao.commit();

        res.status(201).json({
            mensagem: 'Movimentação registrada com sucesso',
            id_movimentacao: resultado.insertId,
            estoque_atual: novoEstoque
        });

    } catch (error) {
        if (conexao) await conexao.rollback();
        tratarErro(res, error);

    } finally {
        if (conexao) conexao.release();
    }
});

// PUT - Editar movimentação
app.put('/movimentacoes/:id', async (req, res) => {
    const { id } = req.params;

    const { tipo, qtd_movimentada } = req.body || {};

    if (
        !idValido(id) ||
        !tipoValido(tipo) ||
        !quantidadeValida(qtd_movimentada)
    ) {
        return res.status(400).json({
            erro: 'Dados da movimentação inválidos'
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [movimentacoes] = await conexao.query(
            `SELECT *
             FROM movimentacoes
             WHERE id_movimentacao = ?
             FOR UPDATE`,
            [id]
        );

        if (!movimentacoes.length) {
            await conexao.rollback();

            return res.status(404).json({
                erro: 'Movimentação não encontrada'
            });
        }

        const anterior = movimentacoes[0];

        const [produtos] = await conexao.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = ?
             FOR UPDATE`,
            [anterior.produtos_id_produto]
        );

        if (!produtos.length) {
            await conexao.rollback();

            return res.status(404).json({
                erro: 'Produto vinculado não encontrado'
            });
        }

        const efeitoAnterior = calcularEfeito(
            anterior.tipo,
            Number(anterior.qtd_movimentada)
        );

        const efeitoNovo = calcularEfeito(
            tipo,
            qtd_movimentada
        );

        const novoEstoque =
            Number(produtos[0].quantidade) -
            efeitoAnterior +
            efeitoNovo;

        if (novoEstoque < 0 || novoEstoque > 2147483647) {
            await conexao.rollback();

            return res.status(400).json({
                erro: 'Alteração resultaria em estoque inválido'
            });
        }

        await conexao.query(
            `UPDATE produtos
             SET quantidade = ?
             WHERE id_produto = ?`,
            [novoEstoque, anterior.produtos_id_produto]
        );

        await conexao.query(
            `UPDATE movimentacoes
             SET tipo = ?, qtd_movimentada = ?
             WHERE id_movimentacao = ?`,
            [tipo, qtd_movimentada, id]
        );

        await conexao.commit();

        res.status(200).json({
            mensagem: 'Movimentação atualizada com sucesso',
            estoque_atual: novoEstoque
        });

    } catch (error) {
        if (conexao) await conexao.rollback();
        tratarErro(res, error);

    } finally {
        if (conexao) conexao.release();
    }
});

// DELETE - Excluir movimentação
app.delete('/movimentacoes/:id', async (req, res) => {
    const { id } = req.params;

    if (!idValido(id)) {
        return res.status(400).json({
            erro: 'ID inválido'
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [movimentacoes] = await conexao.query(
            `SELECT *
             FROM movimentacoes
             WHERE id_movimentacao = ?
             FOR UPDATE`,
            [id]
        );

        if (!movimentacoes.length) {
            await conexao.rollback();

            return res.status(404).json({
                erro: 'Movimentação não encontrada'
            });
        }

        const movimentacao = movimentacoes[0];

        const [produtos] = await conexao.query(
            `SELECT quantidade
             FROM produtos
             WHERE id_produto = ?
             FOR UPDATE`,
            [movimentacao.produtos_id_produto]
        );

        if (!produtos.length) {
            await conexao.rollback();

            return res.status(404).json({
                erro: 'Produto vinculado não encontrado'
            });
        }

        const efeitoAnterior = calcularEfeito(
            movimentacao.tipo,
            Number(movimentacao.qtd_movimentada)
        );

        const novoEstoque =
            Number(produtos[0].quantidade) - efeitoAnterior;

        if (novoEstoque < 0 || novoEstoque > 2147483647) {
            await conexao.rollback();

            return res.status(400).json({
                erro: 'Não é possível reverter esta movimentação'
            });
        }

        await conexao.query(
            `UPDATE produtos
             SET quantidade = ?
             WHERE id_produto = ?`,
            [novoEstoque, movimentacao.produtos_id_produto]
        );

        await conexao.query(
            `DELETE FROM movimentacoes
             WHERE id_movimentacao = ?`,
            [id]
        );

        await conexao.commit();

        res.status(200).json({
            mensagem: 'Movimentação excluída com sucesso',
            estoque_atual: novoEstoque
        });

    } catch (error) {
        if (conexao) await conexao.rollback();
        tratarErro(res, error);

    } finally {
        if (conexao) conexao.release();
    }
});

// =====================================
// TRATAMENTO DE ERROS
// =====================================

// JSON malformado
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            erro: 'JSON inválido'
        });
    }

    next(error);
});

// Rota não encontrada
app.use((req, res) => {
    res.status(404).json({
        erro: 'Rota não encontrada'
    });
});

// Erros inesperados
app.use((error, req, res, next) => {
    tratarErro(res, error);
});

// =====================================
// INICIALIZAÇÃO
// =====================================

// Inicia localmente, mas permite que a Vercel
// importe a aplicação sem iniciar outra porta.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Hertz API rodando na porta ${PORT}`);
    });
}

module.exports = app;

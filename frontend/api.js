const API_URL = 'https://hertz-api.vercel.app';

async function requisitar(caminho, opcoes = {}) {
    let resposta;

    try {
        resposta = await fetch(API_URL + caminho, {
            ...opcoes,
            headers: {
                'Content-Type': 'application/json',
                ...(opcoes.headers || {})
            }
        });
    } catch {
        throw new Error('Não foi possível conectar à API. Verifique o backend.');
    }

    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(corpo.erro || `Erro HTTP ${resposta.status}`);
    }

    return corpo;
}

const api = {
    listarProdutos: () => requisitar('/produtos'),

    criarProduto: dados => requisitar('/produtos', {
        method: 'POST',
        body: JSON.stringify(dados)
    }),

    editarProduto: (id, dados) => requisitar(`/produtos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados)
    }),

    excluirProduto: id => requisitar(`/produtos/${id}`, {
        method: 'DELETE'
    }),

    listarMovimentacoes: () => requisitar('/movimentacoes'),

    criarMovimentacao: dados => requisitar('/movimentacoes', {
        method: 'POST',
        body: JSON.stringify(dados)
    }),

    editarMovimentacao: (id, dados) => requisitar(`/movimentacoes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados)
    }),

    excluirMovimentacao: id => requisitar(`/movimentacoes/${id}`, {
        method: 'DELETE'
    })
};
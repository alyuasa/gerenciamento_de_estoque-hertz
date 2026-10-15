
const modalProduto = document.querySelector('#modal-produto');
const formProduto = document.querySelector('#form-produto');
const buscaProduto = document.querySelector('#buscar-produto');
const container = document.querySelector('#categorias-produtos');

let produtos = [];
let editando = null;

// Guarda quais categorias estão abertas
const categoriasAbertas = new Set();

// ==========================
// CARREGAR PRODUTOS
// ==========================

async function carregarProdutos() {
    try {
        produtos = await api.listarProdutos();
        renderizarProdutos();
    } catch (error) {
        avisar(error.message);

        container.innerHTML = `
            <p class="muted">
                Não foi possível carregar os produtos.
            </p>
        `;
    }
}

// ==========================
// RENDERIZAR POR CATEGORIA
// ==========================

function renderizarProdutos() {
    const busca = buscaProduto.value.toLocaleLowerCase('pt-BR').trim();

    const filtrados = produtos.filter(produto => {
        const texto = `${produto.nome} ${produto.categoria}`;

        return texto.toLocaleLowerCase('pt-BR').includes(busca);
    });

    // Agrupar produtos por categoria
    const categorias = new Map();

    filtrados.forEach(produto => {
        const nome = String(
            produto.categoria || 'Sem categoria'
        ).trim() || 'Sem categoria';

        const chave = nome.toLocaleLowerCase('pt-BR');

        if (!categorias.has(chave)) {
            categorias.set(chave, {
                nome,
                chave,
                itens: []
            });
        }

        categorias.get(chave).itens.push(produto);
    });

    const grupos = Array.from(categorias.values())
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!grupos.length) {
        container.innerHTML = `
            <p class="muted">Nenhum produto encontrado.</p>
        `;
        return;
    }

    container.innerHTML = grupos.map(grupo => {
        // Durante a busca, abrir categorias automaticamente
        const aberta = busca.length > 0 ||
            categoriasAbertas.has(grupo.chave);

        return `
            <details
                class="categoria-acordeao"
                data-categoria="${textoSeguro(grupo.chave)}"
                ${aberta ? 'open' : ''}
            >
                <summary class="categoria-toggle">
                    <div class="categoria-identidade">
                        <div class="categoria-icone">♫</div>

                        <div>
                            <h2>${textoSeguro(grupo.nome)}</h2>
                            <span class="muted">
                                ${grupo.itens.length} produto(s)
                            </span>
                        </div>
                    </div>

                    <span class="categoria-seta" aria-hidden="true">
                        ⌄
                    </span>
                </summary>

                <div class="categoria-conteudo">
                    <div class="produtos-grid">
                        ${grupo.itens.map(produto => `
                            <article class="produto-card">
                                <div class="produto-icon">♫</div>

                                <h3>${textoSeguro(produto.nome)}</h3>

                                <p class="produto-id">
                                    ID: ${textoSeguro(produto.id_produto)}
                                </p>

                                <strong class="produto-preco">
                                    ${moeda(produto.valor)}
                                </strong>

                                <span class="produto-estoque">
                                    ${textoSeguro(produto.quantidade)}
                                    unidades em estoque
                                </span>

                                <div class="produto-actions">
                                    <button
                                        type="button"
                                        class="small-btn"
                                        data-edit="${Number(produto.id_produto)}"
                                    >
                                        Editar
                                    </button>

                                    <button
                                        type="button"
                                        class="small-btn danger"
                                        data-delete="${Number(produto.id_produto)}"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </details>
        `;
    }).join('');
}

// ==========================
// MEMORIZAR CATEGORIAS ABERTAS
// ==========================

container.addEventListener('toggle', evento => {
    const detalhe = evento.target;

    if (!detalhe.matches?.('.categoria-acordeao')) {
        return;
    }

    const chave = detalhe.dataset.categoria;

    // Durante a busca, todas as categorias filtradas abrem
    if (buscaProduto.value.trim()) {
        return;
    }

    if (detalhe.open) {
        categoriasAbertas.add(chave);
    } else {
        categoriasAbertas.delete(chave);
    }
}, true);

// ==========================
// ABRIR MODAL
// ==========================

function abrirProduto(produto = null) {
    formProduto.reset();

    editando = produto?.id_produto ?? null;

    document.querySelector('#titulo-produto').textContent =
        produto ? 'Editar produto' : 'Novo produto';

    document.querySelector('#campo-quantidade').hidden = !!produto;
    document.querySelector('#aviso-quantidade').hidden = !produto;

    formProduto.elements.quantidade.required = !produto;

    if (produto) {
        formProduto.elements.nome.value = produto.nome;
        formProduto.elements.categoria.value = produto.categoria;
        formProduto.elements.valor.value = produto.valor;
    }

    modalProduto.showModal();
}

// ==========================
// NOVO PRODUTO
// ==========================

document.querySelector('#novo-produto').addEventListener('click', () => {
    abrirProduto();
});

// ==========================
// FECHAR MODAL
// ==========================

document.querySelectorAll('#modal-produto [data-fechar]')
    .forEach(botao => {
        botao.addEventListener('click', () => {
            modalProduto.close();
        });
    });

// ==========================
// PESQUISAR PRODUTOS
// ==========================

buscaProduto.addEventListener('input', renderizarProdutos);

// ==========================
// EDITAR E EXCLUIR
// ==========================

container.addEventListener('click', async evento => {
    const editar = evento.target.closest('[data-edit]');
    const excluir = evento.target.closest('[data-delete]');

    if (editar) {
        const produto = produtos.find(
            p => String(p.id_produto) === editar.dataset.edit
        );

        if (produto) {
            abrirProduto(produto);
        }
    }

    if (excluir) {
        const confirmado = confirm(
            'Tem certeza que deseja excluir este produto?'
        );

        if (!confirmado) return;

        try {
            await api.excluirProduto(excluir.dataset.delete);

            avisar('Produto excluído com sucesso!');

            await carregarProdutos();
        } catch (error) {
            avisar(error.message);
        }
    }
});

// ==========================
// SALVAR PRODUTO
// ==========================

formProduto.addEventListener('submit', async evento => {
    evento.preventDefault();

    const dados = {
        nome: formProduto.elements.nome.value.trim(),
        categoria: formProduto.elements.categoria.value.trim(),
        valor: Number(formProduto.elements.valor.value)
    };

    if (editando === null) {
        dados.quantidade = Number(
            formProduto.elements.quantidade.value
        );
    }

    try {
        if (editando === null) {
            await api.criarProduto(dados);
        } else {
            await api.editarProduto(editando, dados);
        }

        modalProduto.close();

        avisar('Produto salvo com sucesso!');

        await carregarProdutos();

    } catch (error) {
        avisar(error.message);
    }
});

// ==========================
// INICIALIZAÇÃO
// ==========================

carregarProdutos();

const modalMov = document.querySelector('#modal-movimentacao');
const formMov = document.querySelector('#form-movimentacao');

let movimentacoes = [];
let produtos = [];
let editandoMov = null;

async function carregarMovimentacoes() {
    try {
        [produtos, movimentacoes] = await Promise.all([
            api.listarProdutos(),
            api.listarMovimentacoes()
        ]);

        const mapa = Object.fromEntries(
            produtos.map(p => [p.id_produto, p.nome])
        );

        document.querySelector('#lista-movimentacoes').innerHTML =
            movimentacoes.map(m => `
                <tr>
                    <td>${textoSeguro(m.id_movimentacao)}</td>
                    <td>${dataLocal(m.data)}</td>
                    <td>${textoSeguro(
                        mapa[m.produtos_id_produto] ||
                        'Produto #' + m.produtos_id_produto
                    )}</td>
                    <td>
                        <span class="pill ${m.tipo === 'entrada' ? 'entrada' : 'saida'}">
                            ${textoSeguro(m.tipo)}
                        </span>
                    </td>
                    <td>${textoSeguro(m.qtd_movimentada)}</td>
                    <td>
                        <div class="actions">
                            <button class="small-btn"
                                data-edit="${m.id_movimentacao}">
                                Editar
                            </button>
                            <button class="small-btn danger"
                                data-delete="${m.id_movimentacao}">
                                Excluir
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('') ||
            '<tr><td colspan="6">Nenhuma movimentação registrada.</td></tr>';

    } catch (error) {
        avisar(error.message);
    }
}

function abrirMov(mov = null) {
    formMov.reset();

    editandoMov = mov?.id_movimentacao ?? null;

    document.querySelector('#titulo-movimentacao').textContent =
        mov ? 'Editar movimentação' : 'Nova movimentação';

    const select = formMov.elements.produtos_id_produto;

    select.innerHTML = produtos.map(p => `
        <option value="${p.id_produto}">
            ${textoSeguro(p.nome)} — Estoque: ${textoSeguro(p.quantidade)}
        </option>
    `).join('');

    select.disabled = !!mov;

    document.querySelector('#aviso-vinculo').hidden = !mov;

    if (mov) {
        select.value = mov.produtos_id_produto;
        formMov.elements.tipo.value = mov.tipo;
        formMov.elements.qtd_movimentada.value = mov.qtd_movimentada;
    }

    if (!produtos.length) {
        avisar('Cadastre um produto antes de registrar movimentações.');
        return;
    }

    modalMov.showModal();
}

document.querySelector('#nova-movimentacao').addEventListener('click', () => {
    abrirMov();
});

document.querySelectorAll('#modal-movimentacao [data-fechar]')
    .forEach(botao => {
        botao.addEventListener('click', () => modalMov.close());
    });

document.querySelector('#lista-movimentacoes')
    .addEventListener('click', async evento => {

        const editar = evento.target.closest('[data-edit]');
        const excluir = evento.target.closest('[data-delete]');

        if (editar) {
            const mov = movimentacoes.find(
                m => String(m.id_movimentacao) === editar.dataset.edit
            );

            if (mov) abrirMov(mov);
        }

        if (excluir) {
            const confirmou = confirm(
                'Excluir esta movimentação? O efeito no estoque será revertido.'
            );

            if (!confirmou) return;

            try {
                await api.excluirMovimentacao(excluir.dataset.delete);
                avisar('Movimentação excluída.');
                await carregarMovimentacoes();

            } catch (error) {
                avisar(error.message);
            }
        }
    });

formMov.addEventListener('submit', async evento => {
    evento.preventDefault();

    const dados = {
        tipo: formMov.elements.tipo.value,
        qtd_movimentada: Number(formMov.elements.qtd_movimentada.value)
    };

    if (editandoMov === null) {
        dados.produtos_id_produto =
            Number(formMov.elements.produtos_id_produto.value);
    }

    try {
        if (editandoMov === null) {
            await api.criarMovimentacao(dados);
        } else {
            await api.editarMovimentacao(editandoMov, dados);
        }

        modalMov.close();
        avisar('Movimentação salva com sucesso.');
        await carregarMovimentacoes();

    } catch (error) {
        avisar(error.message);
    }
});

carregarMovimentacoes();
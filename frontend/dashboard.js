async function carregarDashboard() {
    try {
        const [produtos, movimentacoes] = await Promise.all([
            api.listarProdutos(),
            api.listarMovimentacoes()
        ]);

        const totalUnidades = produtos.reduce(
            (total, p) => total + Number(p.quantidade), 0
        );

        const valorEstoque = produtos.reduce(
            (total, p) =>
                total + Number(p.quantidade) * Number(p.valor),
            0
        );

        const stats = [
            ['Produtos cadastrados', produtos.length],
            ['Unidades em estoque', totalUnidades],
            ['Valor em estoque', moeda(valorEstoque)],
            ['Movimentações', movimentacoes.length]
        ];

        document.querySelector('#stats').innerHTML = stats.map(
            ([nome, valor]) => `
                <div class="stat">
                    <span>${nome}</span>
                    <strong>${textoSeguro(valor)}</strong>
                </div>
            `
        ).join('');

        const mapa = Object.fromEntries(
            produtos.map(p => [p.id_produto, p.nome])
        );

        const recentes = movimentacoes
            .slice()
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .slice(0, 5);

        document.querySelector('#recentes').innerHTML = recentes.map(m => `
            <tr>
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
            </tr>
        `).join('') || `
            <tr>
                <td colspan="4">Nenhuma movimentação registrada.</td>
            </tr>
        `;

    } catch (error) {
        avisar(error.message);
        document.querySelector('#stats').textContent =
            'Não foi possível carregar os indicadores.';
    }
}

carregarDashboard();
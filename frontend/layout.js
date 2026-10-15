const pagina = location.pathname.split('/').pop() || 'index.html';

document.querySelector('#shell').innerHTML = `
<aside class="sidebar">
    <a class="brand" href="index.html">
        <img class="brand-mark" src="./logo.png" alt="Logo Hertz">
        <span>
            <strong>HERTZ</strong>
            <small>MUSIC & AUDIO STORE</small>
        </span>
    </a>

    <nav class="nav">
        <a href="index.html"
           class="${pagina === 'index.html' ? 'active' : ''}">
            ▦ Dashboard
        </a>

        <a href="produtos.html"
           class="${pagina === 'produtos.html' ? 'active' : ''}">
            ▣ Produtos
        </a>

        <a href="movimentacoes.html"
           class="${pagina === 'movimentacoes.html' ? 'active' : ''}">
            ⇄ Movimentações
        </a>
    </nav>

    <div class="sidebar-bottom">
        <button id="theme-toggle" class="switch" type="button"></button>
    </div>
</aside>
`;

document.querySelector('#theme-toggle')
    .addEventListener('click', alternarTema);

atualizarBotaoTema();

let avisoTimer;

function avisar(mensagem) {
    const toast = document.querySelector('#toast');

    toast.textContent = mensagem;
    toast.classList.add('show');

    clearTimeout(avisoTimer);

    avisoTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 4500);
}

function textoSeguro(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[caractere]));
}

function moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function dataLocal(valor) {
    return valor ? new Date(valor).toLocaleString('pt-BR') : '—';
}
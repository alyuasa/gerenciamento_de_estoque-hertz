const temaInicial = localStorage.getItem('hertz-theme') === 'light'
    ? 'light'
    : 'dark';

document.documentElement.dataset.theme = temaInicial;

function alternarTema() {
    const novoTema = document.documentElement.dataset.theme === 'dark'
        ? 'light'
        : 'dark';

    document.documentElement.dataset.theme = novoTema;
    localStorage.setItem('hertz-theme', novoTema);

    atualizarBotaoTema();
}

function atualizarBotaoTema() {
    const botao = document.querySelector('#theme-toggle');

    if (botao) {
        botao.textContent =
            document.documentElement.dataset.theme === 'dark'
                ? '☀ Modo claro'
                : '☾ Modo escuro';
    }
}
// --- FUNÇÕES GLOBAIS DE UI ---

// Declara a variável 'user' no escopo global para que os scripts das páginas possam acessá-la.
// Tenta obter o usuário do localStorage (persistente) primeiro, depois do sessionStorage.
let user = JSON.parse(localStorage.getItem('user')) || JSON.parse(sessionStorage.getItem('user'));
let currentEmbedUrl = ''; // Variável global para a URL de embed
let copyLinkBtn = null; // Variável global para o botão de copiar link


// Função de logout movida para o escopo global para ser acessível por updateHeader
function handleLogout(e) {
    e.preventDefault();
    // Limpa o cache da API ao fazer logout
    apiCache.clear();

    sessionStorage.removeItem('user');
    localStorage.removeItem('user'); // Garante que o logout persistente também seja feito
    window.location.href = 'pages/login.html';
}

function updateHeader() {
    const user = JSON.parse(localStorage.getItem('user')) || JSON.parse(sessionStorage.getItem('user'));
    // Se não houver usuário, não faz nada no cabeçalho/rodapé
    if (!user) return;

    const headerUserInfo = document.getElementById('user-info-container');
    const sidebarUserProfile = document.getElementById('sidebar-user-profile');
    const placeholderSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40' fill='%23CBD5E1'%3E%3Ccircle cx='20' cy='20' r='20'/%3E%3Cpath d='M20 24.5c-2.49 0-4.5 2.01-4.5 4.5v.5h9v-.5c0-2.49-2.01-4.5-4.5-4.5zm0-11c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5z' fill='%23F8FAFC'/%3E%3C/svg%3E`;
    const photoHtml = user.photoUrl 
        ? `<img src="${user.photoUrl}" alt="Foto de Perfil" class="user-photo">`
        : `<img src="${placeholderSvg}" alt="Foto de Perfil" class="user-photo">`;

    const headerContentHtml = `${photoHtml} <span>Olá, ${user.name}</span> <a href="#" class="logout-btn">Sair</a>`;
    const sidebarProfileContentHtml = `${photoHtml} <span>${user.name}</span>`;

    if (headerUserInfo) {
        headerUserInfo.innerHTML = headerContentHtml;
        const logoutButtonInHeader = headerUserInfo.querySelector('.logout-btn');
        if (logoutButtonInHeader) {
            logoutButtonInHeader.addEventListener('click', handleLogout);
        }
    }

    if (sidebarUserProfile) {
        sidebarUserProfile.innerHTML = sidebarProfileContentHtml;
        sidebarUserProfile.style.cursor = 'pointer';
        sidebarUserProfile.addEventListener('click', () => {
            const perfilLink = document.querySelector('.sidebar-footer .nav-link[data-page="perfil"]');
            if (perfilLink) {
                loadPage('perfil', perfilLink);
            }
        });
    }
}

// Função para carregar o conteúdo da página (movida para o escopo global)
function loadPage(pageName, linkElement) {
    const mainHeaderTitle = document.querySelector('.main-header h1');
    const links = document.querySelectorAll('.nav-link');
    const contentArea = document.getElementById('content-area');

    // Usa a API Fetch para buscar o conteúdo do arquivo HTML
    fetch(`pages/${pageName}.html`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Página não encontrada.');
            }
            return response.text();
        })
        .then(html => {
            contentArea.innerHTML = html;

            // Mapeia o nome da página para a função de inicialização correspondente
            const initFunctions = {
                'dashboard': window.initDashboard,
                'visualizar-arquivos': window.initVisualizarArquivos,
                'mapeamento-processos': window.initMapeamentoProcessos,
                'gerador-assinatura': window.initGeradorAssinatura,
                'agenda-equipamentos': window.initAgendaEquipamentos,
                'calendario-formaturas': window.initCalendarioFormaturas,
                'calendario-academico': window.initCalendarioAcademico,
                'fotos-colacao': window.initFotosColacao,
                'gerenciar-usuarios': window.initGerenciarUsuarios,
                'perfil': window.initPerfil
            };

            // Chama a função de inicialização se ela existir
            if (typeof initFunctions[pageName] === 'function') {
                initFunctions[pageName]();
            }

            // Atualiza o título principal
            mainHeaderTitle.textContent = linkElement.textContent;

            // Atualiza a classe 'active' no menu
            links.forEach(link => link.classList.remove('active'));
            linkElement.classList.add('active');

            // Atualiza a URL de embed e a visibilidade do botão
            if (copyLinkBtn) { // Garante que o botão existe
                if (pageName !== 'perfil' && pageName !== 'dashboard') {
                    copyLinkBtn.style.display = 'inline-block';
                    currentEmbedUrl = new URL(`pages/embed.html?page=${pageName}`, window.location.href).href;
                } else {
                    copyLinkBtn.style.display = 'none';
                    currentEmbedUrl = ''; // Limpa a URL se não for aplicável
                }
            }
        })
        .catch(error => {
            console.error('Erro ao carregar a página:', error);
            contentArea.innerHTML = `<p>Ocorreu um erro ao carregar o conteúdo. Verifique o console.</p>`;
        });
}


// --- SISTEMA DE CACHE ---
const apiCache = new Map();

/**
 * Limpa uma chave específica do cache. Usado após operações de escrita (criar, atualizar, deletar).
 * @param {string} key A chave do cache a ser removida (ex: 'getFiles').
 */
function clearCache(key) {
    apiCache.delete(key);
}

/**
 * Atualiza o objeto do usuário no storage local e de sessão.
 * @param {object} updatedUser O objeto de usuário atualizado.
 */
function updateUserInStorage(updatedUser) {
    const userString = JSON.stringify(updatedUser);
    if (localStorage.getItem('user')) localStorage.setItem('user', userString);
    if (sessionStorage.getItem('user')) sessionStorage.setItem('user', userString);
}

// --- FUNÇÃO GLOBAL DE API ---
/**
 * Função centralizada para fazer chamadas à API do Google Apps Script.
 * @param {string} action - A ação a ser executada no backend.
 * @param {object} data - Dados adicionais para enviar no corpo da requisição.
 * @returns {Promise<object>} - A resposta JSON do servidor.
 */
function callApi(action, data = {}) {
    const user = JSON.parse(sessionStorage.getItem('user')) || {};
    const loadingOverlay = document.getElementById('loading-overlay');
    const requestBody = { action, userRole: user.role, userEmail: user.email, ...data };

    // Mostra o indicador de carregamento
    loadingOverlay.style.display = 'flex';

    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).then(response => response.text())
      .then(text => JSON.parse(text))
      .finally(() => {
        // Esconde o indicador de carregamento, independentemente do resultado
        loadingOverlay.style.display = 'none';
      });
}

// Se o usuário foi encontrado no localStorage, também o colocamos no sessionStorage
// para garantir consistência em partes do código que podem depender dele (como embed.html).
if (localStorage.getItem('user') && !sessionStorage.getItem('user')) {
    sessionStorage.setItem('user', localStorage.getItem('user'));
}

document.addEventListener('DOMContentLoaded', function() {
    copyLinkBtn = document.getElementById('copy-embed-link-btn'); // Atribui o elemento à variável global
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            // Função para dar feedback visual de sucesso
            const showSuccess = (btn) => {
                const originalText = btn.textContent;
                btn.textContent = 'Link Copiado!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            };

            // 1. Tenta o método moderno (API Clipboard), que só funciona em contextos seguros (HTTPS/localhost)
            if (navigator.clipboard) {
                navigator.clipboard.writeText(currentEmbedUrl).then(() => showSuccess(copyLinkBtn)).catch(err => {
                    console.error('Falha ao copiar com a API Clipboard: ', err);
                    alert('Não foi possível copiar o link.');
                });
            } else {
                // 2. Fallback para contextos não seguros (HTTP) ou navegadores antigos
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = currentEmbedUrl;
                    // Estilos para tornar o textarea invisível
                    textArea.style.position = 'fixed';
                    textArea.style.top = '-9999px';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showSuccess(copyLinkBtn);
                } catch (err) {
                    console.error('Falha ao copiar com o método de fallback: ', err);
                    alert('Não foi possível copiar o link.');
                }
            }
        });
    }

    // Se não houver usuário na sessão, redireciona para a página de login
    if (!user) {
        // O script main.js é executado a partir do index.html (raiz), então o caminho correto é 'pages/login.html'
        window.location.href = 'pages/login.html';
        return; // Interrompe a execução do script
    }

    // --- DEFINIÇÃO DE PERMISSÕES ---
    const permissions = {
        'diretora': [
            'dashboard', 
            'visualizar-arquivos', 
            'mapeamento-processos', 
            'gerador-assinatura', 
            'agenda-equipamentos', 
            'calendario-formaturas',
            'calendario-academico', 
            'fotos-colacao',
            'gerenciar-usuarios'
        ],
        'funcionario': [
            'dashboard', 
            'visualizar-arquivos', 
            'mapeamento-processos',
            'gerador-assinatura', 
            'agenda-equipamentos',
            'calendario-formaturas',
            'calendario-academico',
            'fotos-colacao'
        ],
        'estagiario': [
            'dashboard', 
            'visualizar-arquivos', 
            'mapeamento-processos', 
            'gerador-assinatura', 
            'agenda-equipamentos', 
            'calendario-formaturas',
            'calendario-academico', 
            'fotos-colacao'
        ]
    };

    const userPermissions = permissions[user.role] || [];

    // --- ATUALIZAÇÃO DA INTERFACE COM DADOS DO USUÁRIO ---
    const mainHeaderTitle = document.querySelector('.main-header h1');
    const sidebarNav = document.querySelector('.sidebar-nav');

    updateHeader();

    // --- LÓGICA DE NAVEGAÇÃO ---
    const links = document.querySelectorAll('.nav-link');
    let firstVisibleLink = null;
    links.forEach(link => {
        const page = link.dataset.page;

        // Verifica se o usuário tem permissão para ver esta página
        if (userPermissions.includes(page)) {
            link.parentElement.style.display = 'block'; // Mostra a aba
            if (!firstVisibleLink) {
                firstVisibleLink = link; // Guarda o primeiro link visível para carregar como página inicial.
            }
        } else {
            link.parentElement.style.display = 'none'; // Esconde a aba
        }
        link.addEventListener('click', (event) => { event.preventDefault(); loadPage(page, link); });
    });

    // Carrega a página inicial permitida para o usuário
    if (firstVisibleLink) {
        loadPage(firstVisibleLink.dataset.page, firstVisibleLink);
    } else if (user) { // Apenas mostra acesso negado se o usuário estiver logado mas sem permissões
        contentArea.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para visualizar nenhuma página.</p>';
    }

    /**
     * Pré-carrega o HTML das outras páginas em segundo plano para uma navegação mais rápida.
     */
    function prefetchPages() {
        links.forEach(link => {
            const pageName = link.dataset.page;
            fetch(`pages/${pageName}.html`);
        });
    }
    prefetchPages(); // Inicia o pré-carregamento
});
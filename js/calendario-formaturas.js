// Este script será executado quando a página calendario-formaturas.html for carregada.

let allFormaturasData = {}; // Armazena todos os dados para filtragem no cliente

// --- Lógica da Tabela ---
function loadFormaturas() {

    // Verifica o cache
    if (apiCache.has('getFormaturas')) {
        const result = apiCache.get('getFormaturas');
        if (result.status === 'success') {
            allFormaturasData = result.data || {};
            displayInitialView(); // Renderiza a visualização inicial com o ano atual
        } else {
            const noResultsMessage = document.getElementById('no-semester-results');
            if (noResultsMessage) {
                noResultsMessage.textContent = result.message;
            }
        }
        return;
    }

    callApi('getFormaturas').then(result => {
        apiCache.set('getFormaturas', result); // Salva no cache
        if (result.status === 'success') {
            allFormaturasData = result.data || {};
            displayInitialView();
        } else {
            throw new Error(result.message);
        }
    }).catch(error => {
        const noResultsMessage = document.getElementById('no-semester-results');
        if (noResultsMessage) {
            noResultsMessage.textContent = error.message;
        }
    });
}

function renderTableContent(formaturas, canManage, tableId) {
    const table = document.getElementById(tableId);
    let tableBody = table.querySelector("tbody");
    if (!tableBody) { // Cria o tbody se não existir
        tableBody = document.createElement('tbody');
        table.appendChild(tableBody);
    }
    tableBody.innerHTML = '';

    if (Object.keys(formaturas).length === 0) {
        // A mensagem de "nenhum resultado" é tratada na função renderSemesterTables
        return;
    }

    // Ordena as formaturas por data
    const sortedFormaturas = Object.entries(formaturas).sort(([, a], [, b]) => new Date(a.data) - new Date(b.data));

    for (const [docId, formatura] of sortedFormaturas) {
        const row = document.createElement('tr');
        row.dataset.docId = docId;
        // Formata a data para o padrão brasileiro e converte quebras de linha dos cursos para <br>
        const formattedDate = new Date(formatura.data + 'T12:00:00').toLocaleDateString('pt-BR');
        const formattedCursos = (formatura.cursos || '').replace(/\n/g, ', ');

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${formatura.local}</td>
            <td>${formattedCursos}</td>
            <td class="actions-column">
                ${canManage ? `<button class="btn-delete" data-id="${docId}">Excluir</button>` : ''}
            </td>
        `;
        tableBody.appendChild(row);
    }
    addDeleteEventListeners();
}

function renderSemesterTables(semester1, semester2, canManage) {
    const semesterResultsContainer = document.getElementById('semester-results-container');
    const sem1Container = document.getElementById('semester-1-container');
    const sem2Container = document.getElementById('semester-2-container');
    const noResultsMessage = document.getElementById('no-semester-results');

    semesterResultsContainer.style.display = 'block';

    const tableHeaderHTML = `
        <thead>
            <tr>
                <th>Data</th>
                <th>Local</th>
                <th>Cursos</th>
                <th class="actions-column">Ações</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    if (semester1.length === 0 && semester2.length === 0) {
        sem1Container.style.display = 'none';
        sem2Container.style.display = 'none';
        noResultsMessage.textContent = 'Nenhuma data encontrada para este ano.';
        noResultsMessage.style.display = 'block';
        return;
    }

    noResultsMessage.style.display = 'none';

    if (semester1.length > 0) {
        sem1Container.style.display = 'block';
        const table1 = document.getElementById('semester-1-table');
        table1.innerHTML = tableHeaderHTML;
        renderTableContent(Object.fromEntries(semester1), canManage, 'semester-1-table');
    } else {
        sem1Container.style.display = 'none';
    }

    if (semester2.length > 0) {
        sem2Container.style.display = 'block';
        const table2 = document.getElementById('semester-2-table');
        table2.innerHTML = tableHeaderHTML;
        renderTableContent(Object.fromEntries(semester2), canManage, 'semester-2-table');
    } else {
        sem2Container.style.display = 'none';
    }

    // Re-aplica a lógica de ocultar coluna de ações para as novas tabelas
    if (window.isEmbeddedContext) {
        document.querySelectorAll('.actions-column').forEach(el => el.style.display = 'none');
    }
}

function displayInitialView() {
    const searchInput = document.getElementById('search-input');
    const currentYear = new Date().getFullYear();
    searchInput.value = currentYear; // Preenche o campo de busca com o ano atual

    // Mostra o contêiner e a mensagem de carregamento inicial
    const semesterContainer = document.getElementById('semester-results-container');
    semesterContainer.style.display = 'block';
    document.getElementById('no-semester-results').textContent = 'Carregando...';
    document.getElementById('no-semester-results').style.display = 'block';
    
    const semester1 = Object.entries(allFormaturasData).filter(([, formatura]) => {
        const formaturaDate = new Date(formatura.data);
        return formaturaDate.getFullYear() === currentYear && formaturaDate.getMonth() <= 6; // Jan a Jul
    });

    const semester2 = Object.entries(allFormaturasData).filter(([, formatura]) => {
        const formaturaDate = new Date(formatura.data);
        return formaturaDate.getFullYear() === currentYear && formaturaDate.getMonth() > 6; // Ago a Dez
    });

    renderSemesterTables(semester1, semester2, (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext);
    document.getElementById('clear-search-button').style.display = 'inline-block';
}

// --- Lógica de Busca ---
function handleSearch() {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearButton = document.getElementById('clear-search-button');

    const performSearch = () => {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) {
            displayInitialView(); // Se a busca for limpa, volta para a visualização do ano atual
            clearButton.style.display = 'none';
            return;
        }

        const match = searchTerm.match(/^(\d{4})$/);
        if (!match) {
            alert('Formato de busca inválido. Use um ano com 4 dígitos (ex: 2025).');
            return;
        }

        const year = parseInt(match[1], 10);

        const semester1 = Object.entries(allFormaturasData).filter(([, formatura]) => {
            const formaturaDate = new Date(formatura.data);
            return formaturaDate.getFullYear() === year && formaturaDate.getMonth() <= 6; // Jan a Jul
        });

        const semester2 = Object.entries(allFormaturasData).filter(([, formatura]) => {
            const formaturaDate = new Date(formatura.data);
            return formaturaDate.getFullYear() === year && formaturaDate.getMonth() > 6; // Ago a Dez
        });

        renderSemesterTables(semester1, semester2, (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext);
        clearButton.style.display = 'inline-block';
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        performSearch();
    });
}

function addDeleteEventListeners() {
    // Procura por botões de exclusão em todas as tabelas de resultados
    document.querySelectorAll('#semester-1-table .btn-delete, #semester-2-table .btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta data de formatura?')) {
                callApi('deleteFormatura', { documentId: docId })
                    .then(result => {
                    if (result.status === 'success') {
                        clearCache('getFormaturas'); // Limpa o cache
                        document.querySelector(`tr[data-doc-id="${docId}"]`).remove();
                        alert('Data de formatura excluída com sucesso.');
                    } else { throw new Error(result.message); }
                }).catch(error => alert(`Erro ao excluir: ${error.message}`));
            }
        });
    });
}

// --- Lógica do Formulário ---
function handleFormaturaForm() {
    const managementArea = document.getElementById('formatura-management-area');
    const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const form = document.getElementById('add-formatura-form');
    const messageEl = document.getElementById('formatura-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        button.textContent = 'Adicionando...';

        const formaturaData = {
            data: document.getElementById('form-data').value,
            local: document.getElementById('form-local').value,
            cursos: document.getElementById('form-cursos').value,
        };

        callApi('addFormatura', { formaturaData })
            .then(result => {
            if (result.status === 'success') {
                messageEl.textContent = 'Data adicionada com sucesso!';
                messageEl.style.color = 'green';
                form.reset();
                clearCache('getFormaturas'); // Limpa o cache
                loadFormaturas(); // Recarrega a tabela
            } else { throw new Error(result.message); }
        }).catch(error => {
            messageEl.textContent = `Erro: ${error.message}`;
            messageEl.style.color = 'red';
        }).finally(() => {
            button.disabled = false;
            button.textContent = 'Adicionar Data';
        });
    });
}

// --- Inicialização ---
function initCalendarioFormaturas() {
    // No modo iframe, oculta a coluna de ações inteira
    if (window.isEmbeddedContext) {
        document.querySelectorAll('.actions-column').forEach(el => {
            el.style.display = 'none';
        });
    }

    loadFormaturas();
    handleFormaturaForm();
    handleSearch();
}
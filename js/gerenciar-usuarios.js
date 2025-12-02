// Este script será executado quando a página gerenciar-usuarios.html for carregada.

// Função para carregar e exibir os usuários na tabela
function loadUsers() {
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    const tableBody = document.querySelector("#users-table tbody");
    tableBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

    // Verifica o cache
    if (apiCache.has('getUsers')) {
        renderUsers(apiCache.get('getUsers'));
        return;
    }

    callApi('getUsers', { adminRole: user.role }).then(result => {
        apiCache.set('getUsers', result); // Salva no cache
        renderUsers(result);
    }).catch(error => {
        console.error('Erro em loadUsers:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="error-message">${error.message}</td></tr>`;
    });
}

function renderUsers(result) {
    const loggedInUser = JSON.parse(sessionStorage.getItem('user'));
    const tableBody = document.querySelector("#users-table tbody");
    try {
        if (result.status === 'success') {
            tableBody.innerHTML = ''; // Limpa a tabela
            if (result.data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhum usuário encontrado.</td></tr>';
                return;
            }
            result.data.forEach(user => {
                // Impede que o usuário logado se exclua
                const isCurrentUser = user.email === loggedInUser.email;
                const isAnotherDirector = user.role === 'diretora';
                const canEdit = !isCurrentUser && !isAnotherDirector;

                const row = document.createElement('tr');
                row.dataset.userId = user.path; // Armazena o caminho completo
                row.innerHTML = `
                    <td>${user.name || ''}</td>
                    <td>${user.email || ''}</td>
                    <td>
                        <select class="role-select" data-path="${user.path}" ${!canEdit ? 'disabled' : ''}>
                            <option value="estagiario" ${user.role === 'estagiario' ? 'selected' : ''}>Estagiário</option>
                            <option value="funcionario" ${user.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
                            <option value="diretora" ${user.role === 'diretora' ? 'selected' : ''}>Diretora</option>
                        </select>
                    </td>
                    <td class="actions-cell">
                        <button class="btn-save-role" data-path="${user.path}" style="display: none;">Salvar</button>
                        <button class="btn-delete" data-path="${user.path}" ${!canEdit ? 'disabled' : ''}>Excluir</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            // Adiciona os eventos de clique aos botões de exclusão
            addDeleteEventListeners();
            addRoleChangeListeners();
        } else {
            throw new Error(result.message || 'Erro ao carregar usuários.');
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="error-message">${error.message}</td></tr>`;
    }
}

// Função para adicionar eventos de clique aos botões de exclusão
function addDeleteEventListeners() {
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const documentPath = e.target.dataset.path;
            const userName = e.target.closest('tr').querySelector('td').textContent;

            if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
                callApi('deleteUser', { documentId: documentPath, adminRole: user.role }).then(result => {
                    if (result.status === 'success') {
                        clearCache('getUsers'); // Limpa o cache
                        // Remove a linha da tabela sem precisar recarregar tudo
                        document.querySelector(`tr[data-user-id="${documentPath}"]`).remove();
                        alert(result.message); // Informa o sucesso
                    } else {
                        throw new Error(result.message);
                    }
                }).catch(error => alert(`Erro ao excluir usuário: ${error.message}`));
            }
        });
    });
}

// Função para lidar com a mudança de cargo
function addRoleChangeListeners() {
    document.querySelectorAll('.role-select').forEach(select => {
        // Guarda o valor original para poder reverter em caso de erro
        select.addEventListener('change', (e) => {
            const userPath = e.target.dataset.path;
            const saveButton = document.querySelector(`.btn-save-role[data-path="${userPath}"]`);
            if (saveButton) {
                saveButton.style.display = 'inline-block';
            }
        });
    });

    document.querySelectorAll('.btn-save-role').forEach(button => {
        button.addEventListener('click', (e) => {
            const messageEl = document.getElementById('user-update-message'); // Elemento para exibir a mensagem
            messageEl.textContent = ''; // Limpa mensagens anteriores

            const userPath = e.target.dataset.path;
            const select = document.querySelector(`.role-select[data-path="${userPath}"]`);
            const newRole = select.value;

            e.target.disabled = true;
            e.target.textContent = 'Salvando...';

            callApi('updateUserRole', { documentId: userPath, newRole: newRole, adminRole: user.role })
                .then(result => {
                    if (result.status === 'success') {
                        messageEl.textContent = 'Cargo atualizado com sucesso!';
                        messageEl.style.color = 'green';
                        e.target.style.display = 'none'; // Esconde o botão de salvar
                        clearCache('getUsers'); // Limpa o cache para garantir que a próxima carga reflita a mudança
                    } else {
                        throw new Error(result.message);
                    }
                }).catch(error => {
                    messageEl.textContent = `Erro ao atualizar cargo: ${error.message}`;
                    messageEl.style.color = 'red';
                }).finally(() => {
                    e.target.disabled = false;
                    e.target.textContent = 'Salvar';
                });
        });
    });
}

// Função para lidar com a criação de um novo usuário
function handleCreateUserForm() {
    const form = document.getElementById('create-user-form');
    const messageEl = document.getElementById('create-user-message');
    const button = document.getElementById('create-user-button');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        button.disabled = true;
        button.textContent = 'Criando...';
        messageEl.textContent = '';

        const formData = new FormData(form);
        const userData = Object.fromEntries(formData.entries());

        callApi('createUser', { userData, adminRole: user.role }).then(result => {
            if (result.status === 'success') {
                messageEl.textContent = result.message;
                messageEl.style.color = 'green';
                form.reset();
                clearCache('getUsers'); // Limpa o cache
                loadUsers(); // Recarrega a lista de usuários
            } else {
                throw new Error(result.message || 'Não foi possível criar o usuário.');
            }
        }).catch(error => {
            messageEl.textContent = error.message;
            messageEl.style.color = 'red';
        }).finally(() => {
            button.disabled = false;
            button.textContent = 'Criar Usuário';
        });
    });
}

// Inicia as funções da página
function initGerenciarUsuarios() {
    // Apenas a diretora pode ver esta página. No modo iframe, também não deve exibir.
    if (window.isEmbeddedContext) {
        document.getElementById('content-area').innerHTML = '<h1>Acesso Negado</h1><p>Esta funcionalidade não está disponível para visualização externa.</p>';
        return;
    }
    loadUsers();
    handleCreateUserForm();
}
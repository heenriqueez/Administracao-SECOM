// Este script será executado quando a página visualizar-arquivos.html for carregada.



// Função para carregar e exibir os arquivos na lista
function loadFiles() {
    const fileList = document.getElementById("file-list");
    fileList.innerHTML = '<li>Carregando...</li>';

    // Verifica o cache primeiro
    if (apiCache.has('getFiles')) {
        renderFiles(apiCache.get('getFiles'));
        return;
    }

    callApi('getFiles').then(result => {
        apiCache.set('getFiles', result); // Salva no cache
        renderFiles(result);
    }).catch(error => {
        console.error('Erro em loadFiles:', error);
        fileList.innerHTML = `<li class="error-message">${error.message}</li>`;
    });
}

function renderFiles(result) {
    const fileList = document.getElementById("file-list");
    try {
        const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
        if (result.status === 'success') {
            fileList.innerHTML = ''; // Limpa a lista
            const files = result.data;
            if (Object.keys(files).length === 0) {
                fileList.innerHTML = '<li>Nenhum arquivo encontrado.</li>';
                return;
            }
            for (const docId in files) {
                const file = files[docId];
                const listItem = document.createElement('li');
                
                // Decide qual URL usar com base no contexto (embed ou painel)
                let fileUrl = file.url; // URL de download por padrão
                if (window.isEmbeddedContext && file.driveId) {
                    // Constrói a URL de visualização para o iframe
                    fileUrl = `https://drive.google.com/file/d/${file.driveId}/preview`;
                }

                listItem.dataset.docId = docId;
                listItem.innerHTML = `
                    <a href="${fileUrl}" target="_blank">${file.name}</a>
                    ${canManage ? `<button class="btn-delete" data-id="${docId}" data-name="${file.name}">Excluir</button>` : ''}
                `;
                fileList.appendChild(listItem);
            }
            addDeleteFileListeners();
        } else {
            throw new Error(result.message || 'Erro ao carregar arquivos.');
        }
    } catch (error) {
        fileList.innerHTML = `<li class="error-message">${error.message}</li>`;
    }
}

// Função para lidar com o upload de arquivos
function handleFileUpload() {
    const managementArea = document.getElementById('file-management-area');
    const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('file-upload');
    const nameInput = document.getElementById('file-name');
    const messageEl = document.getElementById('upload-message');

    uploadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        const customName = nameInput.value.trim();

        if (!file) {
            messageEl.textContent = 'Por favor, selecione um arquivo.';
            messageEl.style.color = 'red';
            return;
        }
        if (!customName) {
            messageEl.textContent = 'Por favor, digite o nome do documento.';
            messageEl.style.color = 'red';
            return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = 'Enviando...';
        messageEl.textContent = `Enviando ${file.name}...`;
        messageEl.style.color = 'inherit';

        // 1. Converte o arquivo para Base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result;
            const fileData = {
                originalName: file.name,
                customName: customName,
                mimeType: file.type,
                base64Data: base64Data
            };

            // 2. Envia para o backend (Google Apps Script) que salvará no Drive
            callApi('uploadFileToDrive', { fileData })
                .then(result => {
                    if (result.status !== 'success') {
                        throw new Error(result.message || 'Erro ao salvar informações do arquivo.');
                    }
                    messageEl.textContent = 'Arquivo enviado com sucesso!';
                    messageEl.style.color = 'green';
                    fileInput.value = ''; // Limpa o input
                    nameInput.value = ''; // Limpa o nome
                    clearCache('getFiles'); // Limpa o cache para forçar a recarga
                    loadFiles(); // Recarrega a lista
                }).catch(error => {
                    console.error('Erro no upload:', error);
                    messageEl.textContent = `Erro no upload: ${error.message}`;
                    messageEl.style.color = 'red';
                }).finally(() => {
                    uploadButton.disabled = false;
                    uploadButton.textContent = 'Fazer Upload';
                });
        };
        reader.onerror = error => console.error("Erro ao ler o arquivo:", error);
    });
}

// Função para adicionar eventos de clique aos botões de exclusão de arquivo
function addDeleteFileListeners() {
    document.querySelectorAll('#file-list .btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            const fileName = e.target.dataset.name;

            if (confirm(`Tem certeza que deseja excluir o arquivo "${fileName}"?`)) {
                callApi('deleteFile', { documentId: docId }).then(result => {
                    if (result.status === 'success') {
                        clearCache('getFiles'); // Limpa o cache
                        document.querySelector(`li[data-doc-id="${docId}"]`).remove();
                        alert(result.message);
                    } else {
                        throw new Error(result.message);
                    }
                }).catch(error => alert(`Erro ao excluir: ${error.message}`));
            }
        });
    });
}

// Inicia as funções da página
function initVisualizarArquivos() {
    loadFiles();
    handleFileUpload();
}
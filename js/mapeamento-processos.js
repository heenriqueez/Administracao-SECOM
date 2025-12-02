// Este script será executado quando a página mapeamento-processos.html for carregada.

function loadProcessMap() {
    const viewer = document.getElementById('map-viewer');
    viewer.innerHTML = '<p>Carregando mapa de processos...</p>';

    // Verifica o cache primeiro
    if (apiCache.has('getProcessMap')) {
        renderProcessMap(apiCache.get('getProcessMap'));
        return;
    }

    callApi('getProcessMap').then(result => {
        renderProcessMap(result); // Chama a função correta para renderizar e gerenciar o cache
    }).catch(error => {
        viewer.innerHTML = `<p class="error-message">Erro ao carregar o mapa: ${error.message}</p>`;
    });
}

function renderProcessMap(result) {
    const viewer = document.getElementById('map-viewer');
    if (result.status === 'success' && result.data && Object.keys(result.data).length > 0) {
        const mapData = Object.values(result.data)[0];
        const fileUrl = mapData.url;

        if (fileUrl.toLowerCase().includes('.pdf')) {
            viewer.innerHTML = `<iframe src="${fileUrl}" width="100%" height="800px" style="border: none;"></iframe>`;
        } else {
            viewer.innerHTML = `<img src="${fileUrl}" alt="Mapeamento de Processos" style="max-width: 100%; border: 1px solid #ccc;">`;
        }
        apiCache.set('getProcessMap', result); // Salva no cache
    } else {
        viewer.innerHTML = '<p>Nenhum mapa de processos foi configurado ainda.</p>';
    }
}

function handleMapUpload() {
    const managementArea = document.getElementById('map-management-area');
    const canManage = user.role === 'diretora' && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const uploadButton = document.getElementById('map-upload-button');
    const fileInput = document.getElementById('map-file-upload');
    const messageEl = document.getElementById('map-upload-message');

    uploadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            messageEl.textContent = 'Por favor, selecione um arquivo.';
            messageEl.style.color = 'red';
            return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = 'Atualizando...';
        messageEl.textContent = `Enviando ${file.name}...`;
        messageEl.style.color = 'inherit';

        // 1. Converte o arquivo para Base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result;
            const fileData = {
                originalName: file.name,
                mimeType: file.type,
                base64Data: base64Data
            };

            // 2. Envia para o backend para atualizar o mapa no Drive
            callApi('updateProcessMapInDrive', { fileData })
                .then(result => {
                    if (result.status !== 'success') {
                        throw new Error(result.message || 'Erro ao salvar informações do arquivo.');
                    }
                    messageEl.textContent = 'Mapa atualizado com sucesso!';
                    messageEl.style.color = 'green';
                    fileInput.value = '';
                    clearCache('getProcessMap'); // Limpa o cache para forçar a recarga
                    loadProcessMap(); // Recarrega o mapa
                }).catch(error => {
                    console.error('Erro no upload:', error);
                    messageEl.textContent = `Erro: ${error.message}`;
                    messageEl.style.color = 'red';
                }).finally(() => {
                    uploadButton.disabled = false;
                    uploadButton.textContent = 'Atualizar Mapa';
                });
        };
        reader.onerror = error => console.error("Erro ao ler o arquivo:", error);
    });
}

// --- Inicialização ---
function initMapeamentoProcessos() {
    loadProcessMap();
    handleMapUpload();
}
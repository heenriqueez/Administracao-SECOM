// Este script será executado quando a página fotos-colacao.html for carregada.

function loadGalleries() {
    const folderList = document.getElementById('photo-folders-list');
    folderList.innerHTML = '<li>Carregando turmas...</li>';

    // Verifica o cache
    if (apiCache.has('getPhotoGalleries')) {
        renderGalleries(apiCache.get('getPhotoGalleries'));
        return;
    }

    callApi('getPhotoGalleries').then(result => {
        apiCache.set('getPhotoGalleries', result); // Salva no cache
        renderGalleries(result);
    }).catch(error => {
        folderList.innerHTML = `<li class="error-message">Erro ao carregar turmas.</li>`;
        console.error(error);
    });
}

function renderGalleries(result) {
    const folderList = document.getElementById('photo-folders-list');
    try {
        if (result.status === 'success') {
            folderList.innerHTML = '';
            const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
            const galleries = result.data || {};
            if (Object.keys(galleries).length === 0) {
                folderList.innerHTML = '<li>Nenhuma galeria adicionada.</li>';
                return;
            }

            // Ordena as galerias pelo nome em ordem decrescente
            const sortedGalleries = Object.entries(galleries).sort(([, a], [, b]) => b.name.localeCompare(a.name));

            for (const [docId, gallery] of sortedGalleries) {
                const listItem = document.createElement('li');
                listItem.dataset.docId = docId;
                listItem.innerHTML = `
                    <span class="gallery-name">${gallery.name}</span>
                    ${canManage ? `<button class="btn-delete-small" data-id="${docId}">&times;</button>` : ''}
                `;
                
                listItem.addEventListener('click', (event) => {
                    if (event.target.tagName !== 'BUTTON') { // Garante que o clique no botão de excluir não selecione a galeria
                        document.querySelectorAll('#photo-folders-list li').forEach(li => li.classList.remove('active'));
                        listItem.classList.add('active');
                        loadDateSubfolders(gallery.folderId, gallery.name);
                    }
                });
                folderList.appendChild(listItem);
            }
            addDeleteGalleryListeners();
        } else {
            throw new Error(result.message || 'Erro ao carregar galerias.');
        }
    } catch (error) {
        folderList.innerHTML = `<li class="error-message">Erro ao carregar turmas.</li>`;
        console.error(error);
    }
}

function loadDateSubfolders(galleryFolderId, galleryName) {
    const photoGrid = document.getElementById('photo-grid');
    const galleryTitle = document.getElementById('gallery-title');
    
    galleryTitle.textContent = `Galeria: ${galleryName}`;
    photoGrid.innerHTML = '<p>Carregando datas...</p>';

    callApi('getPhotosInFolder', { folderId: galleryFolderId }).then(result => {
        if (result.status === 'success' && result.data.length > 0) {
            photoGrid.innerHTML = ''; // Limpa a área
            const dateList = document.createElement('ul');
            dateList.className = 'date-list';
            photoGrid.appendChild(dateList);

            result.data.forEach(subfolder => {
                const dateItem = document.createElement('li');
                dateItem.textContent = subfolder.name;
                dateItem.dataset.folderId = subfolder.id;
                dateItem.addEventListener('click', () => {
                    loadPhotos(subfolder.id, galleryName, subfolder.name);
                });
                dateList.appendChild(dateItem);
            });
        } else if (result.status === 'success') {
            photoGrid.innerHTML = '<p>Nenhuma data encontrada nesta galeria.</p>';
        } else {
            throw new Error(result.message);
        }
    }).catch(error => {
        photoGrid.innerHTML = `<p class="error-message">Erro ao carregar datas.</p>`;
        console.error(error);
    });
}

function loadPhotos(dateFolderId, galleryName, dateName) {
    const photoGrid = document.getElementById('photo-grid');
    const galleryTitle = document.getElementById('gallery-title');
    galleryTitle.textContent = `Galeria: ${galleryName} - ${dateName}`;
    photoGrid.innerHTML = '<p>Carregando fotos...</p>';

    callApi('getPhotosInDateFolder', { folderId: dateFolderId }).then(result => {
        if (result.status === 'success' && result.data.length > 0) {
            photoGrid.innerHTML = '';
            result.data.forEach((photo, index) => {
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-grid-item';
                
                // URL de thumbnail otimizada e mais estável
                const thumbnailUrl = `https://lh3.googleusercontent.com/d/${photo.id}=s150`; // =s150 define o tamanho da miniatura
                // URL de visualização direta para o modal
                const fullSizeUrl = `https://lh3.googleusercontent.com/d/${photo.id}`;
                
                photoItem.innerHTML = `<img src="${thumbnailUrl}" alt="${photo.name}" loading="lazy">`;

                // Adiciona evento de clique para abrir o modal
                photoItem.addEventListener('click', () => {
                    // Passa o índice atual e a lista completa de fotos
                    openPhotoModal(index, result.data);
                });
                photoGrid.appendChild(photoItem);
            });
        } else if (result.status === 'success') {
            photoGrid.innerHTML = '<p>Nenhuma foto encontrada nesta pasta.</p>';
        } else {
            throw new Error(result.message);
        }
    }).catch(error => {
        photoGrid.innerHTML = `<p class="error-message">Erro ao carregar fotos.</p>`;
        console.error(error);
    });
}

function openPhotoModal(startIndex, photos) {
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-photo-img');
    const downloadBtn = document.getElementById('download-photo-btn');
    const closeBtn = modal.querySelector('.close-button');
    const prevBtn = modal.querySelector('.prev-btn');
    const nextBtn = modal.querySelector('.next-btn');

    let currentIndex = startIndex;

    function showPhoto(index) {
        const photo = photos[index];
        const fullSizeUrl = `https://lh3.googleusercontent.com/d/${photo.id}`;
        const downloadUrl = `https://drive.google.com/uc?id=${photo.id}&export=download`;

        modalImg.src = fullSizeUrl;
        modalImg.alt = photo.name;
        downloadBtn.href = downloadUrl;
        downloadBtn.download = photo.name;

        // Controla a visibilidade dos botões de navegação
        prevBtn.style.display = index > 0 ? 'block' : 'none';
        nextBtn.style.display = index < photos.length - 1 ? 'block' : 'none';
    }

    // Mostra a primeira foto
    showPhoto(currentIndex);
    modal.style.display = 'flex';

    // --- Funções de Navegação e Fechamento ---
    function navigate(direction) {
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < photos.length) {
            currentIndex = newIndex;
            showPhoto(currentIndex);
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        // Remove os listeners para evitar acúmulo
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        closeBtn.onclick = null;
        modal.onclick = null;
    }

    // --- Adiciona os Event Listeners ---
    prevBtn.onclick = () => navigate(-1);
    nextBtn.onclick = () => navigate(1);
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); }; // Fecha se clicar no fundo
}

function handleAddGalleryForm() {
    const managementArea = document.getElementById('gallery-management-area');
    const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const form = document.getElementById('add-gallery-form');
    const messageEl = document.getElementById('gallery-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        button.textContent = 'Adicionando...';

        const galleryData = {
            name: document.getElementById('gallery-name').value,
            url: document.getElementById('gallery-url').value,
        };

        callApi('addPhotoGallery', { galleryData })
            .then(result => {
            if (result.status === 'success') {
                messageEl.textContent = 'Galeria adicionada com sucesso!';
                messageEl.style.color = 'green';
                form.reset();
                clearCache('getPhotoGalleries'); // Limpa o cache
                loadGalleries(); // Recarrega a lista
            } else { throw new Error(result.message); }
        }).catch(error => {
            messageEl.textContent = `Erro: ${error.message}`;
            messageEl.style.color = 'red';
        }).finally(() => {
            button.disabled = false;
            button.textContent = 'Adicionar Galeria';
        });
    });
}

function addDeleteGalleryListeners() {
    document.querySelectorAll('.folder-selection .btn-delete-small').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            const galleryName = e.target.closest('li').querySelector('.gallery-name').textContent;
            if (confirm(`Tem certeza que deseja remover a galeria "${galleryName}"?`)) {
                // A ação 'deleteData' é genérica, precisamos especificar a coleção
                callApi('deleteData', { collectionName: 'photoGalleries', documentId: docId, userRole: user.role }).then(result => {
                if (result.status === 'success') {
                    clearCache('getPhotoGalleries'); // Limpa o cache
                    loadGalleries();
                } else { alert(`Erro: ${result.message}`); }
                }).catch(error => alert(`Erro: ${error.message}`));
            }
        });
    });
}

// --- Inicialização ---
function initFotosColacao() {
    loadGalleries();
    handleAddGalleryForm();
}
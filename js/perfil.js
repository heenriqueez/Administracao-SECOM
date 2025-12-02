function initPerfil() {
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const photoPreview = document.getElementById('profile-photo-preview');
    const photoUploadInput = document.getElementById('photo-upload');
    const savePhotoButton = document.getElementById('save-photo-btn');

    // Carrega dados iniciais do usuário
    function loadUserData() {
        const placeholderSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150' fill='%23CBD5E1'%3E%3Ccircle cx='75' cy='75' r='75'/%3E%3Cpath d='M75 93.75c-9.33 0-16.88 7.54-16.88 16.88v1.88h33.75v-1.88c0-9.34-7.54-16.88-16.88-16.88zm0-41.25c-9.33 0-16.88 7.54-16.88 16.88s7.54 16.88 16.88 16.88 16.88-7.54 16.88-16.88-7.54-16.88-16.88-16.88z' fill='%23F8FAFC'/%3E%3C/svg%3E`;
        const currentUser = JSON.parse(localStorage.getItem('user')) || JSON.parse(sessionStorage.getItem('user'));
        if (currentUser) {
            userNameInput.value = currentUser.name;
            userEmailInput.value = currentUser.email;
            if (currentUser.photoUrl) {
                photoPreview.src = currentUser.photoUrl;
            } else {
                photoPreview.src = placeholderSvg;
            }
        }
    }

    // Lida com a atualização do nome
    function handleNameUpdate() {
        const form = document.getElementById('update-name-form');
        const messageEl = document.getElementById('name-message');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = userNameInput.value.trim();
            if (!newName) return;

            callApi('updateProfile', { name: newName }).then(result => {
                if (result.status === 'success') {
                    messageEl.textContent = 'Nome atualizado com sucesso!';
                    messageEl.style.color = 'green';
                    // Atualiza o usuário no storage e no cabeçalho
                    updateUserInStorage(result.user);
                    updateHeader();
                } else {
                    throw new Error(result.message);
                }
            }).catch(error => {
                messageEl.textContent = `Erro: ${error.message}`;
                messageEl.style.color = 'red';
            });
        });
    }

    // Lida com a atualização da senha
    function handlePasswordUpdate() {
        const form = document.getElementById('update-password-form');
        const messageEl = document.getElementById('password-message');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;

            if (newPassword.length < 6) {
                messageEl.textContent = 'A nova senha deve ter pelo menos 6 caracteres.';
                messageEl.style.color = 'red';
                return;
            }

            callApi('updateProfile', { currentPassword, newPassword }).then(result => {
                if (result.status === 'success') {
                    messageEl.textContent = 'Senha alterada com sucesso!';
                    messageEl.style.color = 'green';
                    form.reset();
                } else {
                    throw new Error(result.message);
                }
            }).catch(error => {
                messageEl.textContent = `Erro: ${error.message}`;
                messageEl.style.color = 'red';
            });
        });
    }

    // Lida com a atualização da foto
    function handlePhotoUpdate() {
        let selectedFile = null;

        photoUploadInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    photoPreview.src = event.target.result;
                };
                reader.readAsDataURL(selectedFile);
                savePhotoButton.disabled = false;
            }
        });

        savePhotoButton.addEventListener('click', () => {
            if (!selectedFile) return;

            savePhotoButton.disabled = true;
            savePhotoButton.textContent = 'Salvando...';
            const messageEl = document.getElementById('photo-message');
            messageEl.textContent = '';

            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            reader.onload = () => {
                const base64Data = reader.result;
                const photoData = {
                    mimeType: selectedFile.type,
                    base64Data: base64Data
                };

                callApi('updateProfile', { photoData }).then(result => {
                    if (result.status === 'success') {
                        messageEl.textContent = 'Foto atualizada com sucesso!';
                        messageEl.style.color = 'green';
                        updateUserInStorage(result.user);
                        updateHeader();
                    } else {
                        throw new Error(result.message);
                    }
                }).catch(error => {
                    messageEl.textContent = `Erro: ${error.message}`;
                    messageEl.style.color = 'red';
                }).finally(() => {
                    savePhotoButton.disabled = false;
                    savePhotoButton.textContent = 'Salvar Foto';
                });
            };
        });
    }

    // Inicializa todas as funcionalidades
    loadUserData();
    handleNameUpdate();
    handlePasswordUpdate();
    handlePhotoUpdate();
}
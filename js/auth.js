document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();


        const formData = new FormData(loginForm);
        const loginData = Object.fromEntries(formData.entries());

        // Mostra feedback visual para o usuário
        loginButton.disabled = true;
        loginButton.textContent = 'Verificando...';
        errorMessage.textContent = '';

        // Adiciona a ação que o backend espera para identificar a operação de login
        const requestBody = { ...loginData, action: 'login' };

        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            // Mudar Content-Type para text/plain para evitar preflight de CORS
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        })
        .then(response => response.text()) // Primeiro, obter a resposta como texto
        .then(text => {
            const result = JSON.parse(text); // Então, converter o texto para JSON
            if (result.status === 'success') {
                const rememberMe = document.getElementById('remember-me').checked;
                if (rememberMe) {
                    // Salva no localStorage para persistir entre sessões
                    localStorage.setItem('user', JSON.stringify(result.user));
                } else {
                    // Salva no sessionStorage para a sessão atual
                    sessionStorage.setItem('user', JSON.stringify(result.user));
                }
                // Redireciona para o painel principal (subindo um nível a partir de /pages)
                window.location.href = '../index.html';
            } else {
                errorMessage.textContent = result.message || 'Ocorreu um erro.';
            }
        })
        .catch(error => {
            console.error('Erro na autenticação:', error);
            errorMessage.textContent = 'Não foi possível conectar ao servidor.';
        })
        .finally(() => {
            loginButton.disabled = false;
            loginButton.textContent = 'Entrar';
        });
    });

    // Adiciona a lógica para o formulário de esqueci minha senha, se ele existir na página
    if (forgotPasswordForm) {
        const forgotMessage = document.getElementById('forgot-message');
        const forgotButton = document.getElementById('forgot-password-button');

        forgotPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;

            forgotButton.disabled = true;
            forgotButton.textContent = 'Enviando...';
            forgotMessage.textContent = '';

            callApi('forgotPassword', { email })
                .then(result => {
                    if (result.status === 'success') {
                        forgotMessage.textContent = result.message;
                        forgotMessage.style.color = 'green';
                        forgotPasswordForm.reset();
                    } else {
                        throw new Error(result.message);
                    }
                })
                .catch(error => {
                    forgotMessage.textContent = error.message;
                    forgotMessage.style.color = 'red';
                })
                .finally(() => {
                    forgotButton.disabled = false;
                    forgotButton.textContent = 'Recuperar Senha';
                });
        });
    }
});
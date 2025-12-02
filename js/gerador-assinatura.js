// Este script será executado quando a página gerador-assinatura.html for carregada.

function initGeradorAssinatura() {
    const nomeInput = document.getElementById('nomeInput');
    const vinculoInput = document.getElementById('vinculoInput');
    const vinculo2Input = document.getElementById('vinculo2Input');
    const deptoInput = document.getElementById('deptoInput');
    const copyButton = document.getElementById('copyButton');
    
    const previewNome = document.getElementById('previewNome');
    const previewVinculo = document.getElementById('previewVinculo');
    const previewVinculo2 = document.getElementById('previewVinculo2');
    const previewDepto = document.getElementById('previewDepto');
    
    const previewVinculoWrapper = document.getElementById('previewVinculoWrapper');
    const previewVinculo2Wrapper = document.getElementById('previewVinculo2Wrapper');
    const previewDeptoWrapper = document.getElementById('previewDeptoWrapper');
    
    const assinaturaTable = document.getElementById('assinatura');
    
    function updatePreview() {
        previewNome.textContent = nomeInput.value || 'Seu Nome Completo';
    
        if (vinculoInput.value) {
            previewVinculo.textContent = vinculoInput.value;
            previewVinculoWrapper.style.display = 'block';
        } else {
            previewVinculoWrapper.style.display = 'none';
        }
    
        if (vinculo2Input.value) {
            previewVinculo2.textContent = vinculo2Input.value;
            previewVinculo2Wrapper.style.display = 'block';
        } else {
            previewVinculo2Wrapper.style.display = 'none';
        }
    
        if (deptoInput.value) {
            previewDepto.textContent = deptoInput.value;
            previewDeptoWrapper.style.display = 'block';
        } else {
            previewDeptoWrapper.style.display = 'none';
        }
    }
    
    nomeInput.addEventListener('input', updatePreview);
    vinculoInput.addEventListener('input', updatePreview);
    vinculo2Input.addEventListener('input', updatePreview);
    deptoInput.addEventListener('input', updatePreview);
    
    copyButton.addEventListener('click', async () => {
        const htmlContent = assinaturaTable.outerHTML;
        let success = false;

        // 1. Tenta o método moderno (API Clipboard)
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            try {
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([clipboardItem]);
                success = true;
            } catch (err) {
                console.warn('Falha no método moderno de cópia, tentando fallback:', err);
            }
        }

        // 2. Se o método moderno falhar, usa o método de fallback (execCommand)
        if (!success) {
            const listener = (e) => {
                e.clipboardData.setData('text/html', htmlContent);
                e.clipboardData.setData('text/plain', htmlContent);
                e.preventDefault();
            };
            document.addEventListener('copy', listener);
            document.execCommand('copy');
            document.removeEventListener('copy', listener);
            success = true;
        }

        // Feedback visual para o usuário
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copiado!';
        setTimeout(() => { copyButton.textContent = originalText; }, 2500);
    });
    
    updatePreview();
}
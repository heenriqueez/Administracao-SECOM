// Este script será executado quando a página calendario-academico.html for carregada.

let allCalendarsData = {}; // Armazena todos os dados de todos os anos

/**
 * Carrega e exibe as datas do calendário acadêmico.
 */
function loadAcademicDates() {
    const yearSelector = document.getElementById('year-selector');
    yearSelector.innerHTML = '<option>Carregando...</option>';

    callApi('getAcademicCalendar').then(result => {
        if (result.status === 'success' && result.data) {
            allCalendarsData = result.data;
            populateYearSelector(allCalendarsData);
        } else {
            throw new Error(result.message || 'Nenhum calendário encontrado.');
        }
    }).catch(error => {
        console.error('Erro em loadAcademicDates:', error);
        semesterSelector.innerHTML = `<option>${error.message}</option>`;
    });
}

/**
 * Preenche o seletor de Ano.
 * @param {Object} calendars - O objeto com todos os dados dos calendários, chaveado por ano.
 */
function populateYearSelector(calendars) {
    const yearSelector = document.getElementById('year-selector');
    yearSelector.innerHTML = '<option value="">-- Selecione --</option>';

    const years = Object.keys(calendars).sort((a, b) => b - a); // Anos mais recentes primeiro

    if (years.length === 0) {
        yearSelector.innerHTML = '<option>Nenhum calendário cadastrado</option>';
        return;
    }

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    });

    yearSelector.addEventListener('change', handleFilterChange);
}

/**
 * Preenche o seletor de categorias com base nas datas do semestre selecionado.
 * @param {Array<Object>} dates - As datas do semestre selecionado.
 */
function populateCategorySelector(dates) {
    const categorySelector = document.getElementById('category-selector');
    const categoryGroup = document.getElementById('category-filter-group');
    categorySelector.innerHTML = '<option value="all">Todas as Categorias</option>';

    const categoryTitles = {
        matriculas_ajustes: 'Matrículas e Ajustes',
        prazos_academicos: 'Prazos Acadêmicos e Administrativos',
        aulas_recessos_feriados: 'Aulas, Recessos e Feriados',
        editais_processos_seletivos: 'Editais e Processos Seletivos',
        eventos_institucionais: 'Eventos Institucionais',
        outros: 'Outros'
    };

    const categories = [...new Set(dates.map(d => d.category))];
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = categoryTitles[category] || category;
        categorySelector.appendChild(option);
    });

    categoryGroup.style.display = 'block';
    categorySelector.removeEventListener('change', handleFilterChange); // Evita duplicatas
    categorySelector.addEventListener('change', handleFilterChange);
}

/**
 * Lida com a mudança nos filtros e renderiza as datas.
 */
function handleFilterChange() {
    const yearSelector = document.getElementById('year-selector');
    const categorySelector = document.getElementById('category-selector');
    const datesList = document.getElementById('academic-dates-list');

    const selectedYear = yearSelector.value;
    if (!selectedYear) {
        document.getElementById('category-filter-group').style.display = 'none';
        datesList.innerHTML = '<p>Selecione um ano para visualizar as datas.</p>';
        return;
    }

    const datesForYear = allCalendarsData[selectedYear];

    // Apenas popula o seletor de categoria se for uma mudança de semestre
    if (document.getElementById('category-filter-group').style.display === 'none') {
        populateCategorySelector(datesForYear);
    }

    const selectedCategory = categorySelector.value;
    const filteredDates = selectedCategory === 'all'
        ? datesForSemester
        : datesForSemester.filter(d => d.category === selectedCategory);

    renderAcademicDates(filteredDates);
}

/**
 * Renderiza a lista de datas acadêmicas na tela.
 * @param {Array<Object>} dates - Um array de objetos de data já filtrados.
 */
function renderAcademicDates(dates) {
    const datesList = document.getElementById("academic-dates-list");
    datesList.innerHTML = '';

    if (!dates || dates.length === 0) {
        datesList.innerHTML = '<p>Nenhuma data encontrada para os filtros selecionados.</p>';
        return;
    }

    // As datas já devem vir ordenadas da API, mas garantimos aqui.
    dates.sort((a, b) => new Date(a.date) - new Date(b.date));

    dates.forEach(item => {
        const listItem = document.createElement('li');
        // Usa a data de exibição pré-formatada se existir, senão formata a data padrão.
        const displayDate = item.displayDate 
            ? item.displayDate 
            : new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { 
                day: '2-digit', month: '2-digit', year: 'numeric' 
              });

        listItem.innerHTML = `<strong>${displayDate}:</strong> ${item.description}`;
        datesList.appendChild(listItem);
    });
}

/**
 * Lida com o upload e processamento do arquivo PDF do calendário.
 */
function handleCalendarUpload() {
    const managementArea = document.getElementById('calendar-management-area');
    const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const uploadButton = document.getElementById('calendar-upload-button');
    const fileInput = document.getElementById('calendar-file-upload');
    const messageEl = document.getElementById('calendar-upload-message');

    uploadButton.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            messageEl.textContent = 'Por favor, selecione um arquivo PDF.';
            messageEl.style.color = 'red';
            return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = 'Analisando PDF...';
        messageEl.textContent = 'Isso pode levar um minuto. O arquivo está sendo lido e processado...';
        messageEl.style.color = 'inherit';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Data = reader.result;
            const fileData = {
                mimeType: file.type,
                base64Data: base64Data
            };

            callApi('processAcademicCalendar', { fileData })
                .then(result => {
                    if (result.status !== 'success') throw new Error(result.message);
                    
                    messageEl.textContent = 'Calendário processado e atualizado com sucesso!';
                    messageEl.style.color = 'green';
                    fileInput.value = '';
                    loadAcademicDates(); // Recarrega os seletores e a lista de datas
                }).catch(error => {
                    messageEl.textContent = `Erro: ${error.message}`;
                    // Adiciona um log mais detalhado no console para debug
                    console.error("Falha no processamento do calendário:", error);
                    messageEl.style.color = 'red';
                }).finally(() => {
                    uploadButton.disabled = false;
                    uploadButton.textContent = 'Analisar e Atualizar';
                });
        };
        reader.onerror = error => console.error("Erro ao ler o arquivo:", error);
    });
}

function initCalendarioAcademico() {
    loadAcademicDates();
    handleCalendarUpload();
}
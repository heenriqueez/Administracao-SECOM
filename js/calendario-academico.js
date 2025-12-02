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
            yearSelector.innerHTML = `<option>${result.message || 'Nenhum calendário encontrado.'}</option>`;
        }
    }).catch(error => {
        console.error('Erro em loadAcademicDates:', error);
        yearSelector.innerHTML = `<option>${error.message}</option>`;
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
        ? datesForYear
        : datesForYear.filter(d => d.category === selectedCategory);

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
    datesList.innerHTML = '<p class="no-results-message">Nenhuma data encontrada para os filtros selecionados.</p>';
    return;
  }

  dates.sort((a, b) => new Date(a.date) - new Date(b.date));

  const table = document.createElement('table');
  table.classList.add('academic-calendar-table');

  const thead = document.createElement('thead');
  const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
  thead.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Evento/Prazo</th>
      ${canManage ? '<th>Ações</th>' : ''}
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  let currentMonthYear = '';

  dates.forEach((item, index) => {
    const eventDate = new Date(item.date + 'T12:00:00');
    const monthYear = eventDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

    if (monthYear !== currentMonthYear) {
      currentMonthYear = monthYear;
      const monthHeaderRow = document.createElement('tr');
      monthHeaderRow.innerHTML = `<th colspan="${canManage ? 3 : 2}" class="semester-header-row">${currentMonthYear}</th>`;
      tbody.appendChild(monthHeaderRow);
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.displayDate}</td>
      <td>${item.description}</td>
      ${canManage ? `
        <td class="actions-cell">
          <button class="btn-edit" data-index="${index}">Editar</button>
          <button class="btn-delete" data-index="${index}">Excluir</button>
        </td>` : ''
      }
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  datesList.appendChild(table);
  // Garante que os listeners sejam adicionados após a tabela ser renderizada
  addAcademicCalendarEventListeners();
}

/**
 * Lida com o upload e processamento do arquivo PDF do calendário.
 */
function handleCalendarUpload() {
    const managementArea = document.getElementById('calendar-management-area');
    // Apenas diretora e funcionários podem gerenciar o calendário.
    if (user.role !== 'diretora' && user.role !== 'funcionario') {
        managementArea.style.display = 'none';
        return;
    }

    // Adiciona o botão "Adicionar Evento"
    const addButton = document.getElementById('add-event-button');
    if (addButton) {
        addButton.style.display = 'inline-block';
    }

    if (!window.isEmbeddedContext) managementArea.style.display = 'block';
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

/**
 * Adiciona os event listeners para os botões de Adicionar, Editar e Excluir no Calendário Acadêmico.
 */
function addAcademicCalendarEventListeners() {
    const datesList = document.getElementById('academic-dates-list');
    const addEventButton = document.getElementById('add-event-button');
    const modal = document.getElementById('event-modal');
    const closeModalButton = document.querySelector('.close-button');
    const eventForm = document.getElementById('event-modal-form');

    // --- Abrir Modal para Adicionar ---
    addEventButton.onclick = () => {
        eventForm.reset();
        document.getElementById('modal-title').textContent = 'Adicionar Novo Evento';
        document.getElementById('event-index').value = ''; // Limpa o índice
        modal.style.display = 'flex';
    };

    // --- Fechar Modal ---
    closeModalButton.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    // --- Lógica de Editar e Excluir (usando delegação de eventos) ---
    datesList.onclick = (e) => {
        const target = e.target;
        const index = target.dataset.index;
        const selectedYear = document.getElementById('year-selector').value;

        if (!selectedYear || index === undefined) return;

        // --- Ação de Excluir ---
        if (target.classList.contains('btn-delete')) {
            const eventToDelete = allCalendarsData[selectedYear][index];
            if (confirm(`Tem certeza que deseja excluir o evento:\n"${eventToDelete.description}"?`)) {
                callApi('deleteAcademicEvent', { year: selectedYear, eventIndex: index, userRole: user.role })
                    .then(result => {
                        if (result.status !== 'success') throw new Error(result.message);
                        alert('Evento excluído com sucesso!');
                        clearCache('getAcademicCalendar');
                        loadAcademicDates(true); // Força a re-renderização
                    })
                    .catch(error => alert(`Erro ao excluir: ${error.message}`));
            }
        }

        // --- Ação de Editar ---
        if (target.classList.contains('btn-edit')) {
            const eventToEdit = allCalendarsData[selectedYear][index];
            document.getElementById('modal-title').textContent = 'Editar Evento';
            document.getElementById('event-date').value = eventToEdit.date;
            document.getElementById('event-display-date').value = eventToEdit.displayDate;
            document.getElementById('event-description').value = eventToEdit.description;
            document.getElementById('event-category').value = eventToEdit.category || 'outros'; // Pré-seleciona a categoria
            document.getElementById('event-index').value = index;
            modal.style.display = 'flex';
        }
    };

    // --- Lógica para Salvar (Adicionar ou Editar) ---
    eventForm.onsubmit = (e) => {
        e.preventDefault();
        const saveButton = eventForm.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';

        const selectedYear = document.getElementById('year-selector').value;
        const eventIndex = document.getElementById('event-index').value;

        const eventData = {
            date: document.getElementById('event-date').value,
            displayDate: document.getElementById('event-display-date').value,
            description: document.getElementById('event-description').value,
            category: document.getElementById('event-category').value // Pega a categoria do novo seletor
        };

        const isEditing = eventIndex !== '';
        const action = isEditing ? 'updateAcademicEvent' : 'addAcademicEvent';
        const payload = {
            year: selectedYear,
            eventData: eventData,
            userRole: user.role
        };
        if (isEditing) {
            payload.eventIndex = eventIndex;
        }

        callApi(action, payload)
            .then(result => {
                if (result.status !== 'success') throw new Error(result.message);
                alert(`Evento ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
                modal.style.display = 'none';
                clearCache('getAcademicCalendar');
                loadAcademicDates(true); // Força a re-renderização
            })
            .catch(error => alert(`Erro ao salvar: ${error.message}`))
            .finally(() => {
                saveButton.disabled = false;
                saveButton.textContent = 'Salvar Alterações';
            });
    };
}


function initCalendarioAcademico() {
    loadAcademicDates();
    handleCalendarUpload();
}
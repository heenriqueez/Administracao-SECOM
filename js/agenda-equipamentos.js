// Este script será executado quando a página agenda-equipamentos.html for carregada.

let currentDate = new Date();
let allReservations = {};

// --- Lógica do Calendário ---
function generateCalendar(date, calendarBody, monthYearHeader) {
    calendarBody.innerHTML = 'Carregando...';
    const year = date.getFullYear();
    const month = date.getMonth();
    monthYearHeader.textContent = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Função para renderizar o calendário com os dados
    const render = (result) => {
        if (result.status === 'success') {
            allReservations = result.data || {};
        } else {
            throw new Error(result.message);
        }

        const today = new Date();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        calendarBody.innerHTML = '';

        // Preenche os dias vazios do início
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarBody.innerHTML += `<div class="day other-month"></div>`;
        }

        // Preenche os dias do mês
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day';
            dayDiv.textContent = i;
            const dayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const reservationsForDay = Object.entries(allReservations).filter(([id, res]) => res.data === dayString);

            // Verifica se é o dia atual
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayDiv.classList.add('today');
            }

            if (reservationsForDay.length > 0) {
                dayDiv.classList.add('has-reservations');
                // Adiciona o evento de clique APENAS se houver reservas.
                dayDiv.addEventListener('click', () => showDayDetails(dayString, reservationsForDay, document.getElementById('day-modal')));
            }
            calendarBody.appendChild(dayDiv);
        }
    };

    // Verifica o cache primeiro
    if (apiCache.has('getReservations')) {
        render(apiCache.get('getReservations'));
    } else {
        callApi('getReservations').then(result => {
            apiCache.set('getReservations', result); // Salva no cache
            render(result);
        }).catch(error => {
        calendarBody.innerHTML = `<div class="error-message">${error.message}</div>`;
        });
    }
}

// --- Lógica do Modal ---
function showDayDetails(dayString, reservations, modal) {
    const modalTitle = document.getElementById('modal-title');
    const modalList = document.getElementById('modal-reservation-list');
    const date = new Date(dayString + 'T12:00:00');
    modalTitle.textContent = `Reservas para ${date.toLocaleDateString('pt-BR')}`;
    const canManage = user && (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    modalList.innerHTML = '';

    // A função agora só é chamada se houver reservas, então podemos renderizar diretamente.
    reservations.sort(([, a], [, b]) => a.horaInicio.localeCompare(b.horaInicio)).forEach(([id, res]) => {
        const listItem = document.createElement('li');
        // Se for a visualização pública (embed), mostra apenas o básico.
        if (window.isEmbeddedContext) {
            listItem.innerHTML = `
                    <p><strong>Evento:</strong> ${res.eventoNome || 'Não informado'}</p>
                    <p><strong>Equipamento:</strong> ${res.equipamento}</p>
                    <p><strong>Horário:</strong> ${res.horaInicio} - ${res.horaFim}</p>
            `;
        } else { // Na visualização completa, mostra tudo.
            listItem.innerHTML = `
                    <p><strong>Evento:</strong> ${res.eventoNome || 'Não informado'}</p>
                    <p><strong>Equipamento:</strong> ${res.equipamento} (${res.horaInicio} - ${res.horaFim})</p>
                    <p><strong>Solicitante:</strong> ${res.responsavel} (${res.unidade || 'Unidade não informada'})</p>
                    <p><strong>Contato:</strong> ${res.email || ''} / ${res.telefone || ''}</p>
                    <p><strong>SIAPE:</strong> ${res.siape || 'Não informado'}</p>
                    <p><strong>Local:</strong> ${res.eventoLocal || 'Não informado'}</p>
                    <p><strong>Retirada:</strong> ${res.retiradaDataHora ? new Date(res.retiradaDataHora).toLocaleString('pt-BR') : 'Não informado'}</p>
                    <p><strong>Devolução:</strong> ${res.devolucaoDataHora ? new Date(res.devolucaoDataHora).toLocaleString('pt-BR') : 'Não informado'}</p>
                    <p><strong>Montagem:</strong> ${res.desejaMontagem || 'Não'} ${res.montagemDataHora ? `em ${new Date(res.montagemDataHora).toLocaleString('pt-BR')}` : ''}</p>                
                    <p><strong>Público:</strong> ${res.publicoTipo || 'Não informado'} | <strong>Verba:</strong> ${res.verbaPublica || 'Não informado'}</p>
                    ${res.observacoes ? `<p><strong>Obs:</strong> ${res.observacoes}</p>` : ''}
                    ${canManage ? `<button class="btn-delete" data-id="${id}">Excluir</button>` : ''}
                `;
        }
        modalList.appendChild(listItem);
    });
    
    addModalDeleteListeners(modal);
    modal.style.display = 'flex';
}

function addModalDeleteListeners(modal) {
    const modalList = document.getElementById('modal-reservation-list');
    modalList.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir esta reserva?')) {
                callApi('deleteReservation', { documentId: docId })
                    .then(result => {
                    if (result.status === 'success') {
                        clearCache('getReservations'); // Limpa o cache
                        const calendarBody = document.getElementById('calendar-body');
                        const monthYearHeader = document.getElementById('month-year-header');
                        alert('Reserva excluída!');
                        modal.style.display = 'none';
                        generateCalendar(currentDate, calendarBody, monthYearHeader); // Recarrega o calendário
                    } else {
                        throw new Error(result.message);
                    }
                }).catch(error => alert(`Erro: ${error.message}`));
            }
        });
    });
}

// --- Lógica do Formulário de Reserva ---
function handleReservationForm() {
    const managementArea = document.getElementById('reservation-management-area');
    const canManage = (user.role === 'diretora' || user.role === 'funcionario') && !window.isEmbeddedContext;
    if (!canManage) return;

    managementArea.style.display = 'block';
    const form = document.getElementById('add-reservation-form');
    const messageEl = document.getElementById('reservation-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        button.textContent = 'Adicionando...';

        const reservationData = {
            eventoNome: document.getElementById('res-evento-nome').value,
            equipamento: document.getElementById('res-equipamento').value,
            responsavel: document.getElementById('res-responsavel').value,
            unidade: document.getElementById('res-unidade').value,
            siape: document.getElementById('res-siape').value,
            email: document.getElementById('res-email').value,
            telefone: document.getElementById('res-telefone').value,
            horarioContato: document.getElementById('res-horario-contato').value,
            eventoLocal: document.getElementById('res-evento-local').value,
            dataInicio: document.getElementById('res-data-inicio').value,
            dataFim: document.getElementById('res-data-fim').value,
            publicoTipo: document.getElementById('res-publico-tipo').value,
            verbaPublica: document.getElementById('res-verba-publica').value,
            retiradaDataHora: document.getElementById('res-retirada-datahora').value,
            devolucaoDataHora: document.getElementById('res-devolucao-datahora').value,
            montagemDataHora: document.getElementById('res-montagem-datahora').value,
            desejaMontagem: document.getElementById('res-deseja-montagem').checked ? 'Sim' : 'Não',
            observacoes: document.getElementById('res-observacoes').value,
            // Mantém os campos antigos para compatibilidade e para o calendário
            data: document.getElementById('res-data-inicio').value.split('T')[0],
            horaInicio: document.getElementById('res-data-inicio').value.split('T')[1],
            horaFim: document.getElementById('res-data-fim').value.split('T')[1],
        };

        callApi('addReservation', { reservationData })
            .then(result => {
            if (result.status === 'success') {
                messageEl.textContent = 'Reserva adicionada com sucesso!';
                messageEl.style.color = 'green';
                form.reset();
                clearCache('getReservations'); // Limpa o cache
                const calendarBody = document.getElementById('calendar-body');
                const monthYearHeader = document.getElementById('month-year-header');
                generateCalendar(currentDate, calendarBody, monthYearHeader); // Recarrega o calendário
            } else {
                throw new Error(result.message);
            }
        }).catch(error => {
            messageEl.textContent = `Erro: ${error.message}`;
            messageEl.style.color = 'red';
        }).finally(() => {
            button.disabled = false;
            button.textContent = 'Adicionar Reserva';
        });
    });
}

/**
 * Lida com a análise do texto do GLPI para preencher o formulário.
 */
function handleGlpiTextParsing() {
    // Garante que esta funcionalidade não seja executada no modo embed.
    if (window.isEmbeddedContext) {
        const parserContainer = document.querySelector('.glpi-parser-container');
        if (parserContainer) parserContainer.style.display = 'none';
        return;
    }
    const processBtn = document.getElementById('process-glpi-btn');
    if (!processBtn) return;

    processBtn.addEventListener('click', () => {
        const text = document.getElementById('glpi-text-input').value;
        if (!text.trim()) {
            alert('Por favor, cole o texto do chamado na área indicada.');
            return;
        }

        const parsedData = parseGlpiText(text);

        // Preenche o formulário com os dados extraídos
        document.getElementById('res-evento-nome').value = parsedData.eventoNome;
        document.getElementById('res-equipamento').value = parsedData.equipamento;
        document.getElementById('res-responsavel').value = parsedData.responsavel;
        document.getElementById('res-unidade').value = parsedData.unidade;
        document.getElementById('res-siape').value = parsedData.siape;
        document.getElementById('res-email').value = parsedData.email;
        document.getElementById('res-telefone').value = parsedData.telefone;
        document.getElementById('res-horario-contato').value = parsedData.horarioContato;
        document.getElementById('res-evento-local').value = parsedData.eventoLocal;
        document.getElementById('res-data-inicio').value = parsedData.dataInicio;
        document.getElementById('res-data-fim').value = parsedData.dataFim;
        document.getElementById('res-publico-tipo').value = parsedData.publicoTipo;
        document.getElementById('res-verba-publica').value = parsedData.verbaPublica;
        document.getElementById('res-retirada-datahora').value = parsedData.retiradaDataHora;
        document.getElementById('res-devolucao-datahora').value = parsedData.devolucaoDataHora;
        document.getElementById('res-montagem-datahora').value = parsedData.montagemDataHora;
        document.getElementById('res-deseja-montagem').checked = parsedData.desejaMontagem?.toLowerCase() === 'sim';
        document.getElementById('res-observacoes').value = parsedData.observacoes;

        alert('Formulário preenchido! Verifique os dados e clique em "Adicionar Reserva" para confirmar.');
    });
}

/**
 * Extrai informações de um texto de chamado GLPI.
 * @param {string} text O texto bruto do chamado.
 * @returns {object} Um objeto com os dados extraídos.
 */
function parseGlpiText(text) {
    // Normaliza quebras de linha
    const normalizedText = text.replace(/\r\n/g, '\n');

    // Lookahead que define onde o valor atual deve parar de ser capturado.
    // Para quando encontrar uma nova linha com "numero)", ou os títulos conhecidos do formulário GLPI.
    const stopPattern = '(?=\\n\\s*\\d+\\)|\\nInformações|\\nPúblico|\\nRecursos|\\nLogística|\\nObservações|$)';

    // Função auxiliar para extrair o valor de forma dinâmica e segura
    const extractValue = (keyRegexString) => {
        const regex = new RegExp(`\\b${keyRegexString}\\s*:{1,2}\\s*([\\s\\S]*?)${stopPattern}`, 'i');
        const match = normalizedText.match(regex);
        return match && match[1] ? match[1].trim() : '';
    };

    // Função para extrair e formatar data e hora para datetime-local
    const extractDateTime = (keyRegexString) => {
        const rawDate = extractValue(keyRegexString);
        if (!rawDate) return '';
        
        // Converte formato do GLPI (DD-MM-YYYY HH:mm) para o padrão internacional do HTML (YYYY-MM-DDTHH:mm)
        const dateMatch = rawDate.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2})/);
        if (dateMatch) {
            return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}`;
        }
        
        // Fallback
        return rawDate.replace(' ', 'T');
    };

    const responsavel = extractValue('Nome do Solicitante');
    const unidade = extractValue('Órgão/Unidade solicitante');
    const siape = extractValue('SIAPE');
    const email = extractValue('E-mail');
    const telefone = extractValue('Telefone para contato');
    const horarioContato = extractValue('Preferencia de horário para a equipe entrar em contato');
    
    const eventoNome = extractValue('Nome da atividade/evento');
    const eventoLocal = extractValue('Local do evento / Destino do material');

    const dataInicio = extractDateTime('Data e horário de in[ií]cio');
    const dataFim = extractDateTime('Data e horário de t[eé]rmino');
    
    const publicoTipo = extractValue('Tipo de público');
    const verbaPublica = extractValue('Especifique qual\\?');

    const equipamentos1 = extractValue('Marque os itens necessários');
    const equipamentos2 = extractValue('Descreva detalhadamente');
    let equipamento = equipamentos1;
    if (equipamentos2) equipamento += ` - Detalhes: ${equipamentos2}`;

    const retiradaDataHora = extractDateTime('Data e horário da retirada na Secom');
    const devolucaoDataHora = extractDateTime('Data e horário da devoluç[ãa]o na Secom');
    const desejaMontagem = extractValue('Deseja montagem dos equipamentos emprestados\\?');
    const montagemDataHora = extractDateTime('Data e horário para montagem dos equipamentos');

    // Combina informações relevantes no campo de observações
    const infoGeraisEvento = extractValue('Informações gerais sobre o evento.*');
    const obsFinais = extractValue('Observações gerais');
    
    let observacoes = '';
    if (infoGeraisEvento) observacoes += `Info Evento: ${infoGeraisEvento}\n`;
    if (obsFinais) observacoes += `Obs Finais: ${obsFinais}`;

    return {
        eventoNome,
        equipamento: equipamento.trim(),
        responsavel,
        unidade,
        siape,
        email,
        telefone,
        horarioContato,
        eventoLocal,
        dataInicio,
        dataFim,
        publicoTipo,
        verbaPublica,
        retiradaDataHora,
        devolucaoDataHora,
        montagemDataHora,
        desejaMontagem,
        observacoes
    };
}

// --- Event Listeners ---
function addAgendaEventListeners() {
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const closeModalBtn = document.querySelector('.close-button');
    const modal = document.getElementById('day-modal');
    const calendarBody = document.getElementById('calendar-body');
    const monthYearHeader = document.getElementById('month-year-header');

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        generateCalendar(currentDate, calendarBody, monthYearHeader);
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        generateCalendar(currentDate, calendarBody, monthYearHeader);
    });

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// --- Inicialização ---
function initAgendaEquipamentos() {
    const calendarBody = document.getElementById('calendar-body');
    const monthYearHeader = document.getElementById('month-year-header');
    generateCalendar(currentDate, calendarBody, monthYearHeader);

    // Apenas inicializa os formulários se não estiver no modo embed
    if (!window.isEmbeddedContext) {
        handleReservationForm();
        handleGlpiTextParsing();
    }

    // Os listeners do calendário (navegação, modal) devem funcionar em ambos os modos
    addAgendaEventListeners();
}
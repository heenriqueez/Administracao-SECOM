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
        document.getElementById('res-deseja-montagem').checked = parsedData.desejaMontagem.toLowerCase() === 'sim';
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
    // Função auxiliar para extrair valor com base em uma regex de chave
    const extractValue = (keyRegex) => {
        const match = text.replace(/\r\n/g, '\n').match(keyRegex);
        // Se encontrou, pega o texto após '::' ou ':' e remove espaços extras.
        // A regex captura o texto até o final da linha ou até a próxima linha que começa com um padrão de chave.
        return match && match[1] ? match[1].replace(/\n/g, ' ').trim() : '';
    };

    // Função para extrair e formatar data e hora para datetime-local
    const extractDateTime = (keyRegex) => {
        const match = text.match(keyRegex);
        if (!match || !match[1]) return '';
        // Converte 'AAAA-MM-DD HH:mm' para 'AAAA-MM-DDTHH:mm'
        return match[1].trim().replace(' ', 'T');
    };

    // Extrai os dados usando regex flexíveis
    const responsavel = extractValue(/\bNome do Solicitante\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-ZÀ-Ú\s/]+:{1,2}|$)/i);
    const unidade = extractValue(/Órgão\/Unidade solicitante\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-ZÀ-Ú\s/]+:{1,2}|$)/i);
    const siape = extractValue(/\bSIAPE\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const email = extractValue(/\bE-mail\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const telefone = extractValue(/\bTelefone para contato\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const horarioContato = extractValue(/\bPreferencia de horário para a equipe entrar em contato\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const eventoNome = extractValue(/\bNome da atividade\/evento\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const eventoLocal = extractValue(/\bLocal do evento \/ Destino do material\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);

    const dataInicio = extractDateTime(/\bData e horário de in[ií]cio\s*:\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const dataFim = extractDateTime(/\bData e horário de t[eé]rmino\s*:\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const publicoTipo = extractValue(/\bTipo de público\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const verbaPublica = extractValue(/\bEspecifique qual\?\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);

    const retiradaDataHora = extractDateTime(/\bData e horário da retirada na Secom\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const devolucaoDataHora = extractDateTime(/\bData e horário da devoluç[ãa]o na Secom\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const montagemDataHora = extractDateTime(/\bData e horário para montagem dos equipamentos\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);
    const desejaMontagem = extractValue(/\bDeseja montagem dos equipamentos emprestados\?\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-Z\s]+:{1,2}|$)/i);

    // Combina múltiplos campos para obter uma descrição completa dos equipamentos
    const equipamentos1 = extractValue(/\bMarque os itens necessários\s*:{1,2}\s*([\s\S]*?)(?=\n\s*\d+\)|\n\n|\n[A-ZÀ-Ú\s/]+:{1,2}|$)/i);
    const equipamentos2 = extractValue(/\bDescreva detalhadamente\s*:{1,2}\s*([\s\S]*?)(?=\n\n\w|Logística de Empréstimo|$)/i);
    const equipamento = `${equipamentos1}. Detalhes: ${equipamentos2}`.trim();

    // Combina informações relevantes no campo de observações
    const infoGeraisEvento = extractValue(/\bInformaç[oõ]es gerais sobre o evento\s*:{1,2}\s*([\s\S]*?)(?=\n\w+\s*:{1,2}|$)/i);
    const obsFinais = extractValue(/\bObservaç[oõ]es gerais\s*:{1,2}\s*([\s\S]*?)(?=\n\d+\)|\n\w+\s*:{1,2}|$)/i);
    const observacoes = `Info Evento: ${infoGeraisEvento}\nObs Finais: ${obsFinais}`.trim();

    return {
        eventoNome,
        equipamento,
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
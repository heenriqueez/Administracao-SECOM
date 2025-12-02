/**
 * Backend para o Painel de Administração da SECOM/UFJ
 * Integrado com Google Cloud Firestore e Google Drive
 */

// --- Variável Global para o Firestore ---
let firestoreInstance = null;

// --- CONFIGURAÇÃO GLOBAL DO GOOGLE DRIVE ---
// !! IMPORTANTE !! Cole o ID da sua pasta principal do Google Drive aqui.
// Ex: '1a2b3c4d5e6f7g8h9i0j'
const DRIVE_FOLDER_ID = '1uEsl9DdmNP4dGf2R9FEIlZxikgxr8lRa';

// --- CONFIGURAÇÃO DA IA (GEMINI) ---
// A chave deve ser armazenada nas Propriedades do Script com o nome 'GEMINI_API_KEY'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=';

// --- Funções Auxiliares ---

/**
 * Retorna uma resposta JSON para o cliente.
 * @param {Object} data Os dados a serem retornados.
 * @returns {GoogleAppsScript.Content.TextOutput} O objeto ContentService.TextOutput.
 */
function returnJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Extrai o valor primitivo de um campo do Firestore.
 * A biblioteca FirestoreApp retorna objetos como { stringValue: 'valor' }.
 * @param {Object} field O objeto de campo do Firestore.
 * @returns {string|number|boolean|null} O valor primitivo.
 */
function getFieldValue(field) {
  if (!field) return null;
  const valueType = Object.keys(field)[0]; // ex: 'stringValue', 'integerValue'
  return field[valueType];
}

/**
 * Gera uma senha aleatória simples.
 * @param {number} length O comprimento da senha.
 * @returns {string} A senha gerada.
 */
function generatePassword(length = 8) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

/**
 * Conecta-se ao Firestore usando as credenciais das Propriedades do Script.
 * @returns {Firestore} A instância do Firestore.
 */
function getFirestoreInstance() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const clientEmail = scriptProperties.getProperty('client_email');
  // Garante que as quebras de linha na chave privada sejam formatadas corretamente.
  const privateKey = scriptProperties.getProperty('private_key').replace(/\\n/g, '\n'); 
  const projectId = scriptProperties.getProperty('project_id');


  firestoreInstance = FirestoreApp.getFirestore(clientEmail, privateKey, projectId); // A biblioteca mudou de nome
  return firestoreInstance;
}

// --- Ponto de Entrada Principal (API) ---

/**
 * Lida com requisições POST para a API.
 * @param {Object} e O objeto de evento da requisição POST.
 * @returns {GoogleAppsScript.Content.TextOutput} Resposta JSON.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return returnJsonResponse({ status: 'error', message: 'Requisição inválida ou corpo ausente.' });
    }

    const requestBody = JSON.parse(e.postData.contents);
    const action = requestBody.action;

    if (!action) {
      return returnJsonResponse({ status: 'error', message: 'Ação não especificada.' });
    }

    switch (action) {
      case 'login':
        return handleLogin(requestBody.email, requestBody.password);
      case 'forgotPassword':
        return handleForgotPassword(requestBody.email);
      case 'createUser': // Ação para um admin criar um novo usuário
        return handleCreateUser(requestBody.userData, requestBody.adminRole);
      case 'getUsers': // Nova ação para listar usuários
        return handleGetUsers(requestBody.adminRole);
      case 'deleteUser': // Nova ação para excluir um usuário
        return handleDeleteUser(requestBody.documentId, requestBody.adminRole);
      case 'updateUserRole': // Nova ação para atualizar o cargo de um usuário
        return handleUpdateUserRole(requestBody.documentId, requestBody.newRole, requestBody.adminRole);
      case 'updateProfile': // Nova ação para o usuário atualizar seu próprio perfil
        return handleUpdateProfile(requestBody);

      // --- Funcionalidades de Arquivos (Firestore + Cloud Storage) ---
      case 'getFiles':
        return handleGetData('files');
      case 'uploadFileToDrive': // Substitui addFile, usa Google Drive
        return handleUploadFileToDrive(requestBody.fileData, requestBody.userRole);
      case 'deleteFile': // Agora exclui do Firestore e do Drive
        return handleDeleteFile(requestBody.documentId, requestBody.userRole);

      // --- Funcionalidades do Firestore ---
      case 'getReservations':
        return handleGetData('reservas');
      case 'addReservation':
        return handleAddData('reservas', requestBody.reservationData, requestBody.userRole);
      case 'deleteReservation':
        return handleDeleteData('reservas', requestBody.documentId, requestBody.userRole);

      case 'getFormaturas':
        return handleGetData('formaturas');
      case 'addFormatura':
        return handleAddData('formaturas', requestBody.formaturaData, requestBody.userRole);
      case 'deleteFormatura':
        return handleDeleteData('formaturas', requestBody.documentId, requestBody.userRole);

      // --- Funcionalidades de Fotos (Google Drive) ---
      case 'getPhotoGalleries': // Renomeado de getPhotoFolders
        return handleGetData('photoGalleries');
      case 'addPhotoGallery':
        return handleAddPhotoGallery(requestBody.galleryData, requestBody.userRole);
      case 'getPhotosInFolder':
        return handleGetDateSubfolders(requestBody.folderId); // Agora busca subpastas de data
      case 'getPhotosInDateFolder':
        return handleGetPhotosInDateFolder(requestBody.folderId); // Nova ação para buscar fotos

      // --- Mapeamento de Processos ---
      case 'getProcessMap':
        return handleGetProcessMap(); // Usa a nova função dedicada
      case 'updateProcessMapInDrive': // Substitui updateProcessMap
        return handleUpdateProcessMapInDrive(requestBody.fileData, requestBody.userRole);

      // --- Calendário Acadêmico com IA ---
      case 'getAcademicCalendar':
        return handleGetAcademicCalendar();
      case 'processAcademicCalendar':
        return handleProcessAcademicCalendar(requestBody.fileData, requestBody.userRole);
      case 'addAcademicEvent':
        return handleAddAcademicEvent(requestBody.year, requestBody.eventData, requestBody.userRole);
      case 'updateAcademicEvent':
        return handleUpdateAcademicEvent(requestBody.year, requestBody.eventIndex, requestBody.eventData, requestBody.userRole);
      case 'deleteAcademicEvent':
        return handleDeleteAcademicEvent(requestBody.year, requestBody.eventIndex, requestBody.userRole);
      default:
        // Adiciona uma ação genérica para exclusão, usada por 'fotos-colacao'
        if (action === 'deleteData' && requestBody.collectionName) {
            return handleDeleteData(requestBody.collectionName, requestBody.documentId, requestBody.userRole);
        }
        return returnJsonResponse({ status: 'error', message: `Ação desconhecida: ${action}` });
    }
  } catch (error) {
    Logger.log(`Erro em doPost: ${error.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro no servidor: ${error.message}` });
  }
}

function doGet(e) {
  return HtmlService.createHtmlOutput('<p>Backend do Painel SECOM está ativo. Use requisições POST para interagir com a API.</p>');
}

/**
 * Lida com requisições OPTIONS (preflight) para CORS.
 * Isso é necessário para permitir que o frontend faça requisições POST.
 * @param {Object} e O objeto de evento da requisição OPTIONS.
 * @returns {GoogleAppsScript.Content.TextOutput} Resposta com cabeçalhos CORS.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT);
}


// --- Handlers de Autenticação e Usuários (Firebase) ---

/**
 * Lida com a requisição de login.
 */
function handleLogin(email, password) {
  const firestore = getFirestoreInstance();
 
  // Correção Final: Usando a sintaxe da sua versão da biblioteca (.Where e .Execute)
  const results = firestore.query('users').Where('email', '==', email).Where('password', '==', password).Execute();

  if (results.length > 0) {
    const userDoc = results[0];
    const userData = {
      // Garante que o valor do nome seja uma string, extraindo-o do objeto de campo.
      name: getFieldValue(userDoc.fields.name),
      email: getFieldValue(userDoc.fields.email),
      role: getFieldValue(userDoc.fields.role)
    };
    return returnJsonResponse({ status: 'success', user: userData });
  }

  return returnJsonResponse({ status: 'error', message: 'Email ou senha incorretos.' });
}

/**
 * Lida com a recuperação de senha.
 * CORREÇÃO DE SEGURANÇA: Gera uma nova senha em vez de enviar a antiga.
 */
function handleForgotPassword(email) {
  const firestore = getFirestoreInstance();
  const results = firestore.query('users').Where('email', '==', email).Execute();

  if (results.length > 0) {
    const documentPath = results[0].name; // Ex: projects/projectId/databases/(default)/documents/users/docId
    const userFields = results[0].fields;
    const userName = getFieldValue(userFields.name);
    
    const newPassword = generatePassword();

    // Atualiza a senha do usuário no Firestore
    firestore.updateDocument(documentPath, { password: newPassword }, true);
    
    const subject = "Recuperação de Senha - Painel SECOM";
    const body = `Olá, ${userName}.\n\nVocê solicitou a recuperação de sua senha. Sua nova senha de acesso ao Painel de Administração da SECOM é: ${newPassword}\n\nRecomendamos que você guarde esta senha em um local seguro. Se você não solicitou esta recuperação, por favor, entre em contato com a administração.`;
    MailApp.sendEmail(email, subject, body);
    return returnJsonResponse({ status: 'success', message: 'Um e-mail com sua nova senha foi enviado para o endereço informado.' });
  } else {
    return returnJsonResponse({ status: 'error', message: 'O e-mail informado não foi encontrado em nosso sistema.' });
  }
}

/**
 * Cria um novo usuário (ação de administrador).
 */
function handleCreateUser(userData, adminRole) {
  if (adminRole !== 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Apenas administradores podem criar usuários.' });
  }

  const { email, name } = userData;
  if (!email || !name) {
    return returnJsonResponse({ status: 'error', message: 'Nome e e-mail são obrigatórios.' });
  }

  let role = '';
  if (email.endsWith('@ufj.edu.br')) {
    role = 'funcionario'; // Pode ser ajustado para 'diretora' manualmente no Firebase
  } else if (email.endsWith('@discente.ufj.edu.br')) {
    role = 'estagiario';
  } else {
    return returnJsonResponse({ status: 'error', message: 'O domínio do e-mail não é válido (@ufj.edu.br ou @discente.ufj.edu.br).' });
  }

  const password = generatePassword();
  const newUser = { name, email, password, role };

  const firestore = getFirestoreInstance();
  firestore.createDocument('users', newUser);

  const subject = "Sua Conta no Painel SECOM foi Criada";
  const body = `Olá, ${name}.\n\nUma conta foi criada para você no Painel de Administração da SECOM.\n\nSeu login é: ${email}\nSua senha é: ${password}\n\nGuarde esta senha em um local seguro.`;
  MailApp.sendEmail(email, subject, body);

  return returnJsonResponse({ status: 'success', message: `Usuário ${name} criado com sucesso. A senha foi enviada para o e-mail.` });
}

/**
 * Lista todos os usuários (ação de administrador).
 */
function handleGetUsers(adminRole) {
  if (adminRole !== 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }
  const firestore = getFirestoreInstance();
  const documents = firestore.getDocuments('users');
  const users = documents.map(doc => {
    // Não retorna a senha para o frontend
    return { 
      path: doc.name, // Retorna o caminho completo do documento
      name: getFieldValue(doc.fields.name),
      email: getFieldValue(doc.fields.email),
      role: getFieldValue(doc.fields.role)
    };
  });
  return returnJsonResponse({ status: 'success', data: users });
}

/**
 * Exclui um usuário (ação de administrador).
 */
function handleDeleteUser(documentId, adminRole) {
  if (adminRole !== 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }
  if (!documentId) {
    return returnJsonResponse({ status: 'error', message: 'ID do usuário não fornecido.' });
  }

  const firestore = getFirestoreInstance();
  // Medida de segurança: verifica o perfil do usuário antes de excluir.
  const userToDelete = firestore.getDocument(documentId);
  if (userToDelete && userToDelete.fields && getFieldValue(userToDelete.fields.role) === 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Não é permitido excluir um usuário com perfil de diretora.' });
  }

  firestore.deleteDocument(documentId);
  return returnJsonResponse({ status: 'success', message: 'Usuário excluído com sucesso.' });
}

/**
 * Atualiza o cargo de um usuário (ação de administrador).
 */
function handleUpdateUserRole(documentId, newRole, adminRole) {
  if (adminRole !== 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado. Apenas a diretora pode alterar cargos.' });
  }
  if (!documentId || !newRole) {
    return returnJsonResponse({ status: 'error', message: 'ID do usuário ou novo cargo não fornecido.' });
  }
  if (['diretora', 'funcionario', 'estagiario'].indexOf(newRole) === -1) {
    return returnJsonResponse({ status: 'error', message: 'Cargo inválido.' });
  }

  const firestore = getFirestoreInstance();
  const relativeDocumentPath = `users/${documentId.split('/').pop()}`;

  // Medida de segurança: não permitir alterar o cargo de outra diretora.
  const userToUpdate = firestore.getDocument(relativeDocumentPath);
  if (userToUpdate && userToUpdate.fields && getFieldValue(userToUpdate.fields.role) === 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Não é permitido alterar o cargo de outra diretora.' });
  }

  // Atualiza o documento com o novo cargo
  firestore.updateDocument(relativeDocumentPath, { role: newRole }, true);

  return returnJsonResponse({ status: 'success', message: 'Cargo atualizado com sucesso.' });
}

/**
 * Permite que um usuário atualize seu próprio perfil (nome, senha, foto).
 */
function handleUpdateProfile(requestData) {
  const { name, currentPassword, newPassword, photoData, userEmail } = requestData;
  const firestore = getFirestoreInstance();
  
  // Busca o usuário pelo email, que é o identificador único da sessão
  const results = firestore.query('users').Where('email', '==', userEmail).Execute();
  if (results.length === 0) {
    return returnJsonResponse({ status: 'error', message: 'Usuário não encontrado.' });
  }
  
  const userDoc = results[0];
  const documentPath = userDoc.name;
  const userFields = userDoc.fields;
  const updates = {};

  // 1. Atualizar Nome
  if (name) {
    updates.name = name;
  }

  // 2. Atualizar Senha
  if (currentPassword && newPassword) {
    const storedPassword = getFieldValue(userFields.password);
    if (storedPassword !== currentPassword) {
      return returnJsonResponse({ status: 'error', message: 'A senha atual está incorreta.' });
    }
    updates.password = newPassword;
  }

  // 3. Atualizar Foto
  if (photoData) {
    try {
      const { base64Data, mimeType } = photoData;
      const decodedData = Utilities.base64Decode(base64Data.split(',')[1]);
      const blob = Utilities.newBlob(decodedData, mimeType, `photo_${userEmail}.jpg`);
      
      const folder = getDatedUploadFolder('Profile Pictures');
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // Torna o arquivo público para visualização
      // Usa um link otimizado para exibição direta de imagens
      const fileUrl = `https://lh3.googleusercontent.com/d/${file.getId()}`;
      updates.photoUrl = fileUrl;
    } catch (e) {
      return returnJsonResponse({ status: 'error', message: `Erro ao salvar foto: ${e.message}` });
    }
  }

  // Aplica as atualizações se houver alguma
  if (Object.keys(updates).length > 0) {
    const documentId = documentPath.split('/').pop(); // Extrai apenas o ID do caminho completo
    firestore.updateDocument(`users/${documentId}`, updates, true);
  }

  // Retorna o objeto de usuário atualizado para o frontend
  const relativePath = `users/${documentPath.split('/').pop()}`;
  const updatedUserDoc = firestore.getDocument(relativePath);
  const updatedUserData = {
      name: getFieldValue(updatedUserDoc.fields.name),
      email: getFieldValue(updatedUserDoc.fields.email),
      role: getFieldValue(updatedUserDoc.fields.role),
      photoUrl: getFieldValue(updatedUserDoc.fields.photoUrl)
  };

  return returnJsonResponse({ status: 'success', message: 'Perfil atualizado.', user: updatedUserData });
}

// --- Handlers de CRUD Genérico (Firestore) ---

function handleGetData(collectionName) {
  const firestore = getFirestoreInstance();
  const documents = firestore.getDocuments(collectionName);
  // Mapeia os documentos para um formato mais amigável (objeto com IDs)
  const data = {};
  documents.forEach(doc => {
    const fields = {};
    // Extrai o valor de string de cada campo
    for (const key in doc.fields) {
      fields[key] = getFieldValue(doc.fields[key]);
      // Garante que o driveId seja retornado se existir
    }
    data[doc.name.split('/').pop()] = fields; // Usa o ID do documento como chave
  });
  return returnJsonResponse({ status: 'success', data: data });
}

function handleAddData(collectionName, data, userRole) {
  // Adicionar verificação de permissão se necessário
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
     return returnJsonResponse({ status: 'error', message: 'Você não tem permissão para adicionar dados.' });
  }
  const firestore = getFirestoreInstance();
  const newDoc = firestore.createDocument(collectionName, data);
  return returnJsonResponse({ status: 'success', message: 'Dados adicionados com sucesso.', documentId: newDoc.name.split('/').pop() });
}

function handleDeleteData(collectionName, documentId, userRole) {
  // Adicionar verificação de permissão se necessário
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
     return returnJsonResponse({ status: 'error', message: 'Você não tem permissão para excluir dados.' });
  }
  const firestore = getFirestoreInstance();
  firestore.deleteDocument(`${collectionName}/${documentId}`);
  return returnJsonResponse({ status: 'success', message: 'Dados removidos com sucesso.' });
}

// --- Handlers de Arquivos (Google Drive + Firestore) ---

/**
 * Helper para obter ou criar uma subpasta.
 */
function getOrCreateSubfolder(parentFolder, subfolderName) {
  const folders = parentFolder.getFoldersByName(subfolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subfolderName);
}

/**
 * Retorna a pasta de destino para uploads, organizada por Ano/Mês.
 */
function getDatedUploadFolder(uploadType) {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'COLE_O_ID_DA_PASTA_RAIZ_AQUI') {
    throw new Error("O 'DRIVE_FOLDER_ID' não foi configurado no arquivo Code.gs.");
  }
  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  
  const typeFolder = getOrCreateSubfolder(rootFolder, uploadType);
  
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = ('0' + (now.getMonth() + 1)).slice(-2); // Formato MM
  
  const yearFolder = getOrCreateSubfolder(typeFolder, year);
  const monthFolder = getOrCreateSubfolder(yearFolder, month);
  
  return monthFolder;
}

function getRootUploadFolder() {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === 'COLE_O_ID_DA_PASTA_RAIZ_AQUI') { 
    throw new Error("O 'DRIVE_FOLDER_ID' não foi configurado no arquivo Code.gs."); }
  return DriveApp.getFolderById(DRIVE_FOLDER_ID);
}

// --- Handlers de Fotos (Google Drive) ---

/**
 * Lista as subpastas (que são as datas) dentro da pasta principal de uma galeria.
 */
function handleGetDateSubfolders(folderId) {
  try {
    if (!folderId) throw new Error('ID da pasta não fornecido.');
    const folder = DriveApp.getFolderById(folderId);
    const subfolders = folder.getFolders();
    const folderList = [];
    while (subfolders.hasNext()) {
      const subfolder = subfolders.next();
      folderList.push({
        id: subfolder.getId(),
        name: subfolder.getName()
      });
    }
    return returnJsonResponse({ status: 'success', data: folderList });
  } catch (e) {
    Logger.log(`Erro ao listar subpastas de ${folderId}: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro ao listar datas: ${e.message}` });
  }
}

/**
 * Lista os arquivos de imagem dentro de uma subpasta de data específica.
 */
function handleGetPhotosInDateFolder(folderId) {
    try {
        if (!folderId) throw new Error('ID da subpasta de data não fornecido.');
        const folder = DriveApp.getFolderById(folderId);
        const files = folder.getFiles();
        const photoList = [];
        while (files.hasNext()) {
            const file = files.next();
            // Opcional: filtrar por tipo de imagem se necessário
            if (file.getMimeType().startsWith('image/')) {
                photoList.push({ id: file.getId(), name: file.getName() });
            }
        }
        return returnJsonResponse({ status: 'success', data: photoList });
    } catch (e) {
        Logger.log(`Erro ao listar fotos da pasta ${folderId}: ${e.message}`);
        return returnJsonResponse({ status: 'error', message: `Erro ao listar fotos: ${e.message}` });
    }
}

/**
 * Adiciona uma nova galeria de fotos, extraindo o ID da URL.
 */
function handleAddPhotoGallery(galleryData, userRole) {
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }

  const { name, url } = galleryData;
  if (!name || !url) {
    return returnJsonResponse({ status: 'error', message: 'Nome e URL da pasta são obrigatórios.' });
  }

  try {
    // Expressão regular para extrair o ID da pasta de diferentes formatos de URL do Google Drive
    const regex = /\/folders\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/;
    const matches = url.match(regex);
    if (!matches) {
      throw new Error('URL da pasta do Google Drive inválida.');
    }
    const folderId = matches[1] || matches[2];

    const firestore = getFirestoreInstance();
    const newGallery = { name, folderId };
    const newDoc = firestore.createDocument('photoGalleries', newGallery);

    return returnJsonResponse({ status: 'success', message: 'Galeria adicionada com sucesso.', documentId: newDoc.name.split('/').pop() });

  } catch (e) {
    Logger.log(`Erro ao adicionar galeria de fotos: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro ao processar URL: ${e.message}` });
  }
}

/**
 * Lida com o upload de um arquivo para o Google Drive, salvando em subpastas.
 */
function handleUploadFileToDrive(fileData, userRole) {
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }

  const { base64Data, mimeType, originalName, customName } = fileData;
  if (!base64Data || !mimeType || !originalName || !customName) {
    return returnJsonResponse({ status: 'error', message: 'Dados do arquivo incompletos.' });
  }

  try {
    const decodedData = Utilities.base64Decode(base64Data.split(',')[1]);
    
    // Padroniza o nome do arquivo
    const now = new Date();
    const datePrefix = `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}-${('0' + now.getDate()).slice(-2)}`;
    const extension = originalName.includes('.') ? originalName.split('.').pop() : '';
    const standardizedName = `${datePrefix}_${customName.replace(/[^a-zA-Z0-9-]/g, '-')}.${extension}`;

    const blob = Utilities.newBlob(decodedData, mimeType, standardizedName);
    
    const folder = getDatedUploadFolder('Arquivos');
    const file = folder.createFile(blob);
    
    // O link de visualização/download direto
    const fileUrl = `https://drive.google.com/uc?id=${file.getId()}`;

    // Salva os metadados no Firestore
    const firestore = getFirestoreInstance();
    const newDoc = firestore.createDocument('files', { name: customName, url: fileUrl, driveId: file.getId() });

    return returnJsonResponse({ status: 'success', message: 'Arquivo enviado com sucesso.', documentId: newDoc.name.split('/').pop() });
  } catch (e) {
    Logger.log(`Erro no upload para o Drive: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro no servidor ao fazer upload: ${e.message}` });
  }
}

/**
 * Exclui um arquivo do Firestore e do Google Drive.
 */
function handleDeleteFile(documentId, userRole) {
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }

  const firestore = getFirestoreInstance();
  try {
    const docPath = `files/${documentId}`;
    const doc = firestore.getDocument(docPath);
    const driveId = getFieldValue(doc.fields.driveId);

    // 1. Exclui do Firestore
    firestore.deleteDocument(docPath);

    // 2. Exclui do Google Drive
    if (driveId) {
      DriveApp.getFileById(driveId).setTrashed(true);
    }

    return returnJsonResponse({ status: 'success', message: 'Arquivo excluído com sucesso.' });
  } catch (e) {
    Logger.log(`Erro ao excluir arquivo ${documentId}: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro ao excluir: ${e.message}` });
  }
}

/**
 * Atualiza o documento do mapa de processos, salvando o arquivo no Google Drive.
 * Ação restrita à diretora.
 */
function handleUpdateProcessMapInDrive(fileData, userRole) {
  if (userRole !== 'diretora') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }
  const { base64Data, mimeType, originalName } = fileData;
  if (!base64Data || !mimeType || !originalName) {
    return returnJsonResponse({ status: 'error', message: 'Dados do arquivo inválidos.' });
  }

  const firestore = getFirestoreInstance();

  try {
    const decodedData = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(decodedData, mimeType, `mapa-processos_${originalName}`);
    const folder = getDatedUploadFolder('Mapeamento de Processos');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // Torna o arquivo público
    const fileUrl = `https://lh3.googleusercontent.com/d/${file.getId()}`; // Link otimizado para exibição direta de imagem
    
    try {
      firestore.deleteDocument('config/processMap');
    } catch (e) {
      // Ignora o erro se o documento não existir para que um novo possa ser criado.
    }
    firestore.createDocument('config/processMap', { name: originalName, url: fileUrl, driveId: file.getId() });
    return returnJsonResponse({ status: 'success', message: 'Mapa de processos atualizado com sucesso.' });
  } catch (e) {
    Logger.log(`Erro ao atualizar mapa de processos: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro ao atualizar mapa: ${e.message}` });
  }
}

/**
 * Busca o documento específico do mapa de processos.
 * Diferente de handleGetData, que busca uma coleção inteira.
 */
function handleGetProcessMap() {
  const firestore = getFirestoreInstance();
  try {
    const doc = firestore.getDocument('config/processMap');
    if (doc && doc.fields) {
      const fields = {};
      for (const key in doc.fields) {
        fields[key] = getFieldValue(doc.fields[key]);
      }
      // Retorna no formato que o frontend espera (um objeto com o ID como chave)
      const data = { [doc.name.split('/').pop()]: fields };
      return returnJsonResponse({ status: 'success', data: data });
    }
    return returnJsonResponse({ status: 'success', data: {} }); // Documento não encontrado
  } catch (e) {
    Logger.log(`Erro ao buscar mapa de processos: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro ao buscar mapa: ${e.message}` });
  }
}

// --- Handlers do Calendário Acadêmico (IA) ---

/**
 * Busca as datas do calendário acadêmico salvas no Firestore.
 */
function handleGetAcademicCalendar() {
    const firestore = getFirestoreInstance();
    try {
        // Busca todos os documentos na coleção 'academicCalendars'
        const documents = firestore.getDocuments('academicCalendars');
        const allCalendars = {};
        documents.forEach(doc => {
            const year = doc.name.split('/').pop(); // Extrai o ano do path do documento
            if (doc.fields && doc.fields.dates) {
                allCalendars[year] = doc.fields.dates.arrayValue.values.map(mapValue => ({
                    date: getFieldValue(mapValue.mapValue.fields.date),
                    description: getFieldValue(mapValue.mapValue.fields.description),
                    category: getFieldValue(mapValue.mapValue.fields.category) || 'eventos_importantes',
                    displayDate: getFieldValue(mapValue.mapValue.fields.displayDate) // Adiciona o novo campo
                }));
            }
        });
        return returnJsonResponse({ status: 'success', data: allCalendars });
    } catch (e) {
        Logger.log(`Erro ao buscar calendários: ${e.message}`);
        // Se a coleção não existir, retorna um objeto vazio sem erro.
        if (e.message && e.message.toLowerCase().includes('not found')) {
            return returnJsonResponse({ status: 'success', data: {} });
        }
        return returnJsonResponse({ status: 'error', message: `Erro ao buscar calendários: ${e.message}` });
    }
}

/**
 * Adiciona, atualiza ou remove um evento de um calendário acadêmico existente.
 * @param {string} year - O ano do calendário a ser modificado.
 * @param {string} operation - 'add', 'update', ou 'delete'.
 * @param {object} options - Contém dados do evento e/ou índice.
 * @param {string} userRole - O cargo do usuário para verificação de permissão.
 * @returns {GoogleAppsScript.Content.TextOutput} Resposta JSON.
 */
function modifyAcademicCalendar(year, operation, options, userRole) {
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }
  if (!year) {
    return returnJsonResponse({ status: 'error', message: 'Ano do calendário não especificado.' });
  }

  const firestore = getFirestoreInstance();
  const docPath = `academicCalendars/${year}`;

  try {
    const doc = firestore.getDocument(docPath);
    let dates = [];
    if (doc && doc.fields && doc.fields.dates) {
      // Converte os dados do Firestore de volta para um array de objetos JS
      dates = doc.fields.dates.arrayValue.values.map(mapValue => ({
        date: getFieldValue(mapValue.mapValue.fields.date),
        displayDate: getFieldValue(mapValue.mapValue.fields.displayDate),
        description: getFieldValue(mapValue.mapValue.fields.description),
        category: getFieldValue(mapValue.mapValue.fields.category)
      }));
    }

    switch (operation) {
      case 'add':
        const newEvent = options.eventData;
        // Adiciona uma categoria padrão se não for fornecida
        if (!newEvent.category) {
            newEvent.category = 'outros';
        }
        dates.push(newEvent);
        break;
      case 'update':
        if (options.eventIndex === undefined || !options.eventData) {
          throw new Error('Índice ou dados do evento ausentes para atualização.');
        }
        dates[options.eventIndex] = options.eventData;
        break;
      case 'delete':
        if (options.eventIndex === undefined) {
          throw new Error('Índice do evento ausente para exclusão.');
        }
        dates.splice(options.eventIndex, 1);
        break;
      default:
        throw new Error('Operação inválida.');
    }

    // Ordena o array antes de salvar
    dates.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Salva o array de datas modificado de volta no Firestore
    firestore.updateDocument(docPath, { dates: dates }, true);

    return returnJsonResponse({ status: 'success', message: `Evento ${operation === 'add' ? 'adicionado' : operation === 'update' ? 'atualizado' : 'excluído'} com sucesso.` });
  } catch (e) {
    Logger.log(`Erro ao modificar calendário ${year}: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro no servidor: ${e.message}` });
  }
}

// Funções de wrapper para simplificar as chamadas da API
function handleAddAcademicEvent(year, eventData, userRole) {
  return modifyAcademicCalendar(year, 'add', { eventData }, userRole);
}

function handleUpdateAcademicEvent(year, eventIndex, eventData, userRole) {
  return modifyAcademicCalendar(year, 'update', { eventIndex, eventData }, userRole);
}

function handleDeleteAcademicEvent(year, eventIndex, userRole) {
  return modifyAcademicCalendar(year, 'delete', { eventIndex }, userRole);
}


function handleProcessAcademicCalendar(fileData, userRole) {
  if (userRole !== 'diretora' && userRole !== 'funcionario') {
    return returnJsonResponse({ status: 'error', message: 'Acesso negado.' });
  }
  try {
    const decodedData = Utilities.base64Decode(fileData.base64Data.split(',')[1]);
    const blob = Utilities.newBlob(decodedData, fileData.mimeType);
    const textContent = extractTextFromPdf(blob);

    if (!textContent || textContent.trim().length < 100) {
      throw new Error("Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem ou estar corrompido.");
    }

    const extractedData = parseCalendarText(textContent);

    if (!extractedData || !extractedData.year || extractedData.dates.length === 0) {
      throw new Error("Nenhuma data ou ano principal pôde ser extraído do documento. Verifique o formato do arquivo.");
    }

    const firestore = getFirestoreInstance();
    // Salva os dados em um documento nomeado com o ano extraído.
    const documentPath = `academicCalendars/${extractedData.year}`;
    firestore.updateDocument(documentPath, { dates: extractedData.dates }, true);

    return returnJsonResponse({ status: 'success', message: 'Calendário processado com sucesso.' });
  } catch (e) {
    Logger.log(`Erro ao processar calendário: ${e.message}`);
    return returnJsonResponse({ status: 'error', message: `Erro no processamento: ${e.message}` });
  }
}


/**
 * Analisa o texto extraído de um PDF de calendário acadêmico e extrai as datas.
 * Esta função substitui a necessidade de uma IA externa.
 * @param {string} text - O conteúdo de texto completo do PDF.
 * @returns {object} Um objeto no formato { year: 'YYYY', dates: [{ date: 'YYYY-MM-DD', description: '...', semester: '1' }] }.
 */
function parseCalendarText(text) {
  /**
   * Classifica um evento em uma categoria com base em palavras-chave na descrição.
   * @param {string} description A descrição do evento.
   * @returns {string} A categoria do evento ('processos_academicos', 'feriados_recessos', 'eventos_importantes').
   */
    function categorizeEvent(description) {
        const descLower = description.toLowerCase();

        const categories = {
            matriculas_ajustes: ['matrícula', 'acréscimo', 'cancelar', 'trancamento', 'ajuste'],
            prazos_academicos: ['data limite', 'prazo', 'solicitar', 'validar', 'validação', 'encaminhar', 'consolidar', 'pré-requisito', 'correquisito', 'planos de ensino'],
            aulas_recessos_feriados: ['início das aulas', 'término das aulas', 'recesso', 'feriado', 'facultativo', 'confraternização'],
            editais_processos_seletivos: ['edital', 'inscrição', 'processamento', 'mudanças de grau', 'vagas remanescentes', 'disciplinas/módulos isolados'],
            eventos_institucionais: ['congresso', 'conepe', 'vem pra ufj', 'orgulho ufj', 'aniversário da ufj', 'colação de grau', 'dia internacional', 'dia nacional']
        };

        if (categories.matriculas_ajustes.some(keyword => descLower.includes(keyword))) {
            return 'matriculas_ajustes';
        }
        if (categories.editais_processos_seletivos.some(keyword => descLower.includes(keyword))) {
            return 'editais_processos_seletivos';
        }
        if (categories.prazos_academicos.some(keyword => descLower.includes(keyword))) {
            return 'prazos_academicos';
        }
        if (categories.aulas_recessos_feriados.some(keyword => descLower.includes(keyword))) {
            return 'aulas_recessos_feriados';
        }
        if (categories.eventos_institucionais.some(keyword => descLower.includes(keyword))) {
            return 'eventos_institucionais';
        }

        return 'outros'; // Categoria padrão para o que não se encaixar
    }

  const dates = [];
  // Normaliza quebras de linha e divide o texto, garantindo consistência.
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let currentMonth = '';
  let currentYear = '';

  const monthMap = {
    'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
    'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
  };

  // Tenta encontrar o ano principal do calendário (ex: "Rotinas 2025")
  const yearMatchGlobal = text.match(/(?:EVENTOS E ROTINAS|ROTINAS|CALENDÁRIO ACADÊMICO)\s+(\d{4})/i);
  if (yearMatchGlobal) {
    currentYear = yearMatchGlobal[1];
  }

  const mainCalendarYear = currentYear;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Detecta cabeçalho de Mês/Ano (ex: DEZEMBRO 2024)
    const monthYearMatch = line.match(/^([A-ZÇ]+)\s+(\d{4})$/i);
    if (monthYearMatch) {
      const monthName = monthYearMatch[1].toUpperCase();
      if (monthMap[monthName]) {
        currentMonth = monthMap[monthName];
        currentYear = monthYearMatch[2];
      }
      continue;
    }

    // Detecta cabeçalho de Mês (ex: JANEIRO)
    const monthMatch = line.match(/^([A-ZÇ]+)$/i);
    if (monthMatch) {
      const monthName = monthMatch[1].toUpperCase();
      if (monthMap[monthName]) {
        // Lógica de virada de ano
        if (currentMonth === '12' && monthMap[monthName] === '01' && mainCalendarYear) {
          currentYear = (parseInt(currentYear, 10) + 1).toString();
        }
        currentMonth = monthMap[monthName];
      }
      continue;
    }

    // Detecta uma linha que começa com uma data ou período (ex: "13", "06 a 08")
    const dateLineMatch = line.match(/^(\d{1,2}(?:\s*(?:a|e)\s*\d{1,2})?)/);
    if (dateLineMatch && currentMonth && currentYear) {
      // Guarda a linha original para medir a indentação da descrição
      const originalLine = lines[i]; 
      const dateInfo = dateLineMatch[1];
      let description = line.substring(dateInfo.length).trim();
      
      // Mede a indentação da primeira linha da descrição
      const descriptionStartIndex = originalLine.indexOf(description);

      // Coleta as próximas linhas como parte da descrição até encontrar uma nova data ou cabeçalho
      let nextLineIndex = i + 1;
      while (nextLineIndex < lines.length) {
        const nextOriginalLine = lines[nextLineIndex];
        const nextLine = nextOriginalLine.trim();
        const nextLineStartIndex = nextOriginalLine.search(/\S/); // Posição do primeiro caractere não-espaço

        // Para se a próxima linha estiver vazia, for um cabeçalho de mês, ou começar com uma data.
        // OU se a indentação for a mesma, indicando um novo evento no mesmo dia.
        if (!nextLine || monthMap[nextLine.toUpperCase()] || /^\d{1,2}(?:\s*(?:a|e)\s*\d{1,2})?/.test(nextLine) || (nextLineStartIndex > 0 && nextLineStartIndex === descriptionStartIndex)) {
          break;
        }

        // Ignora lixo de formatação
        if (!nextLine.toUpperCase().startsWith('ANEXO') && !nextLine.toUpperCase().startsWith('RODOVIA BR')) {
            description += ' ' + nextLine;
        }
        nextLineIndex++;
      }
      i = nextLineIndex - 1; // Pula o ponteiro do loop principal para depois das linhas de descrição lidas

      // Processa a data e a descrição coletada
      const day = dateInfo.match(/^\d{1,2}/)[0]; // Pega apenas o primeiro dia para ordenação
      let displayDate = dateInfo;

      // Formata a data de exibição para incluir o mês e ano
      if (dateInfo.includes('a') || dateInfo.includes('e')) {
        displayDate = `${dateInfo.replace(' e ', ' a ')}/${currentMonth}/${currentYear}`;
      } else {
        displayDate = `${day.padStart(2, '0')}/${currentMonth}/${currentYear}`;
      }

      dates.push({
        date: `${currentYear}-${currentMonth.padStart(2, '0')}-${day.padStart(2, '0')}`,
        displayDate: displayDate,
        description: description.trim(),
        category: categorizeEvent(description)
      });
    }
  }

    // Remove duplicatas e ordena
    const uniqueDates = Array.from(new Set(dates.map(d => JSON.stringify(d)))).map(s => JSON.parse(s));
    uniqueDates.sort((a, b) => new Date(a.date) - new Date(b.date));

    return { year: mainCalendarYear, dates: uniqueDates };
}

/**
 * Função auxiliar para extrair texto de um blob PDF usando a API avançada do Drive.
 * É necessário ativar o "Drive API" em "Serviços" no editor do Apps Script.
 */
function extractTextFromPdf(pdfBlob) {
  // Abordagem correta para OCR usando a API v3:
  // 1. Define os metadados do arquivo, especificando o 'mimeType' de destino como Google Doc para forçar a conversão e OCR.
  // 2. Usa 'Drive.Files.create' para enviar o arquivo com os metadados.
  // 3. Abre o Google Doc resultante para ler seu texto.
  // 4. Exclui o Google Doc temporário.
  // Para ativá-lo: Editor de Script > Serviços > Adicionar Serviço > Drive API.
  try {
    const fileMetadata = {
      name: 'temp_pdf_for_ocr.pdf', // API v3 usa 'name'
      // ESSENCIAL: Define o mimeType de destino para forçar a conversão para Google Doc e ativar o OCR.
      mimeType: 'application/vnd.google-apps.document'
    };
    
    // Usa o método 'create' (API v3). O blob de origem é PDF, mas o mimeType nos metadados
    // instrui o Drive a criar um Google Doc a partir dele.
    const docFile = Drive.Files.create(fileMetadata, pdfBlob);
    const doc = DocumentApp.openById(docFile.id);
    const textContent = doc.getBody().getText();
    
    // Limpa o arquivo Google Doc temporário
    Drive.Files.remove(docFile.id);
    
    return textContent;
  } catch (e) {
    throw new Error(`Falha ao extrair texto do PDF. Verifique se a "Drive API" está ativada nos Serviços do Apps Script. Erro original: ${e.message}`);
  }
}
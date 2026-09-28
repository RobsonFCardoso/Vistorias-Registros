import { Registro, RegistroFormData } from '../types';
import { 
  saveAllPhotosToMobile, 
  deleteRegistroFolderAndPhotos, 
  writeRegistrosCsvToDevice, 
  LOCALSTORAGE_KEY,
  SaveFotosResult
} from './storageService';

export const STORAGE_KEY = LOCALSTORAGE_KEY;
export { writeRegistrosCsvToDevice };

// Base de dados limpa (Zero Data) - Sem registros fictícios
export const INITIAL_DEMO_REGISTROS: Registro[] = [];

/**
 * Retorna todos os registros mantidos no LocalStorage
 */
export function getLocalRegistros(): Registro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.error('Erro ao ler registros do LocalStorage:', err);
    return [];
  }
}

/**
 * 100% Offline: Lê os registros mantidos no LocalStorage
 */
export async function fetchRegistros(): Promise<Registro[]> {
  const records = getLocalRegistros();
  try {
    await writeRegistrosCsvToDevice(records);
  } catch (csvErr) {
    console.warn('Falha na sincronização do CSV na leitura:', csvErr);
  }
  return records;
}

/**
 * 100% Offline: Busca um registro por ID
 */
export async function fetchRegistroById(id: string): Promise<Registro> {
  const records = getLocalRegistros();
  const found = records.find(r => r.id === id);
  if (!found) {
    throw new Error(`Registro com ID #${id} não encontrado.`);
  }
  return found;
}

/**
 * 100% Offline: Cria um novo registro
 * - Gravação física obrigatória das 4 fotos via saveAllPhotosToMobile
 * - Validação individual de cada uma das 4 fotos
 * - Gravação e atualização imediata no LocalStorage
 * - Atualização do arquivo Registros.csv no celular
 */
export async function createRegistro(payload: RegistroFormData): Promise<{
  registro: Registro;
  saveResult: SaveFotosResult;
}> {
  const currentRecords = getLocalRegistros();

  // Determina próximo ID sequencial
  let maxId = 0;
  for (const r of currentRecords) {
    const num = parseInt(r.id, 10);
    if (!isNaN(num) && num > maxId) {
      maxId = num;
    }
  }
  const nextId = String(maxId + 1);
  const cleanPlaca = payload.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Converte e normaliza com segurança os 4 campos de foto
  const normalizePhoto = (newVal?: string, existingVal?: string): string => {
    if (newVal && newVal.trim()) {
      const trimmed = newVal.trim();
      return trimmed.startsWith('data:') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
    }
    return existingVal?.trim() || '';
  };

  const foto1Val = normalizePhoto(payload.foto1Base64, payload.foto1Existing);
  const foto2Val = normalizePhoto(payload.foto2Base64, payload.foto2Existing);
  const foto3Val = normalizePhoto(payload.foto3Base64, payload.foto3Existing);
  const foto4Val = normalizePhoto(payload.foto4Base64, payload.foto4Existing);

  // Salva as 4 fotos fisicamente no celular com validação física de existência e tamanho
  const saveResult = await saveAllPhotosToMobile(nextId, cleanPlaca, {
    foto1: foto1Val,
    foto2: foto2Val,
    foto3: foto3Val,
    foto4: foto4Val,
  });

  const newRecord: Registro = {
    id: nextId,
    nomeBlitz: payload.nomeBlitz?.trim() || 'Operação de Vistoria',
    dia: payload.dia,
    hora: payload.hora,
    placa: cleanPlaca,
    foto1: foto1Val,
    foto2: foto2Val,
    foto3: foto3Val,
    foto4: foto4Val,
    status: payload.status,
  };

  // 1. Gravação imediata no LocalStorage
  const updatedRecords = [newRecord, ...currentRecords];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao gravar no localStorage:', lsErr);
  }

  // 2. Gravação do CSV no dispositivo
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV no dispositivo celular:', csvErr);
  }

  return { registro: newRecord, saveResult };
}

/**
 * 100% Offline: Atualiza um registro existente no LocalStorage e no CSV
 * - Preserva rigorosamente as fotos existentes caso não tenham sido alteradas
 * - Salva fisicamente no celular as 4 fotos atualizadas
 */
export async function updateRegistro(
  id: string, 
  payload: Partial<RegistroFormData>
): Promise<{
  registro: Registro;
  saveResult: SaveFotosResult;
}> {
  const currentRecords = getLocalRegistros();
  const existing = currentRecords.find(r => r.id === id);
  if (!existing) {
    throw new Error(`Registro com ID #${id} não encontrado.`);
  }

  const cleanPlaca = payload.placa
    ? payload.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    : existing.placa;

  // Normaliza os 4 campos de foto preservando rigorosamente os existentes
  const normalizeUpdatePhoto = (newVal?: string, fallbackExisting?: string): string => {
    if (newVal && newVal.trim()) {
      const trimmed = newVal.trim();
      return trimmed.startsWith('data:') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
    }
    return fallbackExisting?.trim() || '';
  };

  const foto1Val = normalizeUpdatePhoto(payload.foto1Base64, existing.foto1);
  const foto2Val = normalizeUpdatePhoto(payload.foto2Base64, existing.foto2);
  const foto3Val = normalizeUpdatePhoto(payload.foto3Base64, existing.foto3);
  const foto4Val = normalizeUpdatePhoto(payload.foto4Base64, existing.foto4);

  // Salva as 4 fotos fisicamente no celular com validação física
  const saveResult = await saveAllPhotosToMobile(id, cleanPlaca, {
    foto1: foto1Val,
    foto2: foto2Val,
    foto3: foto3Val,
    foto4: foto4Val,
  });

  const updated: Registro = {
    id,
    nomeBlitz: payload.nomeBlitz !== undefined ? payload.nomeBlitz : existing.nomeBlitz,
    dia: payload.dia || existing.dia,
    hora: payload.hora || existing.hora,
    placa: cleanPlaca,
    foto1: foto1Val,
    foto2: foto2Val,
    foto3: foto3Val,
    foto4: foto4Val,
    status: payload.status || existing.status,
  };

  // 1. Gravação imediata no LocalStorage
  const updatedRecords = currentRecords.map(r => r.id === id ? updated : r);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao gravar no localStorage:', lsErr);
  }

  // 2. Atualização no CSV nativo
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV no dispositivo celular:', csvErr);
  }

  return { registro: updated, saveResult };
}

/**
 * 100% Offline: Exclui um registro do LocalStorage, do CSV e da pasta física de fotos
 */
export async function deleteRegistro(id: string): Promise<void> {
  const currentRecords = getLocalRegistros();
  const existing = currentRecords.find(r => r.id === id);
  const updatedRecords = currentRecords.filter(r => r.id !== id);

  // 1. Atualização do LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch (lsErr) {
    console.error('Erro ao atualizar localStorage na exclusão:', lsErr);
  }

  // 2. Exclusão da pasta física e fotos do celular
  if (existing) {
    try {
      await deleteRegistroFolderAndPhotos(existing.id, existing.placa);
    } catch (fsErr) {
      console.warn('Aviso ao excluir pasta de fotos do celular:', fsErr);
    }
  }

  // 3. Atualização do Registros.csv
  try {
    await writeRegistrosCsvToDevice(updatedRecords);
  } catch (csvErr) {
    console.warn('Falha na gravação do CSV na exclusão:', csvErr);
  }
}

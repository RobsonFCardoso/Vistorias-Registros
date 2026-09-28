import { BlitzOption, DEFAULT_BLITZ_OPTIONS } from '../types';

export const BLITZ_STORAGE_KEY = 'blitz_cadastradas';

/**
 * Carrega a lista de blitzes salvas no LocalStorage ou retorna as padrões
 */
export function getLocalBlitzList(): BlitzOption[] {
  try {
    const raw = localStorage.getItem(BLITZ_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Inicializa com as opções padrão se estiver vazio
    localStorage.setItem(BLITZ_STORAGE_KEY, JSON.stringify(DEFAULT_BLITZ_OPTIONS));
    return DEFAULT_BLITZ_OPTIONS;
  } catch (err) {
    console.error('Erro ao ler blitz do localStorage:', err);
    return DEFAULT_BLITZ_OPTIONS;
  }
}

/**
 * Salva ou atualiza uma blitz no LocalStorage
 */
export function saveLocalBlitz(blitz: BlitzOption): BlitzOption[] {
  const list = getLocalBlitzList();
  const exists = list.some(b => b.id === blitz.id);
  const updated = exists
    ? list.map(b => b.id === blitz.id ? blitz : b)
    : [...list, blitz];

  try {
    localStorage.setItem(BLITZ_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar blitz no localStorage:', err);
  }
  return updated;
}

/**
 * Remove uma blitz do LocalStorage
 */
export function deleteLocalBlitz(id: string): BlitzOption[] {
  const list = getLocalBlitzList();
  const updated = list.filter(b => b.id !== id);
  try {
    localStorage.setItem(BLITZ_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao excluir blitz do localStorage:', err);
  }
  return updated;
}

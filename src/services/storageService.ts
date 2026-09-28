import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { setCachedPhoto, deleteCachedPhoto } from '../utils/indexedDbCache';

export const CSV_FILENAME = 'Registros.csv';
export const CSV_HEADER = 'ID,Placa,Status,Data,Fotos';
export const ROOT_PHOTOS_DIR = 'Download/RegistroFotos';
export const ROOT_DOCUMENTS_PHOTOS_DIR = 'RegistroFotos';
export const LOCALSTORAGE_KEY = 'registros_vistorias';

/**
 * Verifica se está executando nativamente no Android / iOS via Capacitor
 */
export function isNativeMobile(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Solicita e verifica permissões nativas necessárias no Android (Câmera e Armazenamento)
 */
export async function requestAndroidPermissions(): Promise<{
  camera: boolean;
  storage: boolean;
}> {
  let cameraGranted = true;
  let storageGranted = true;

  if (isNativeMobile()) {
    try {
      const camStatus = await Camera.requestPermissions();
      cameraGranted = camStatus.camera === 'granted';
    } catch (e) {
      console.warn('Aviso ao solicitar permissão de câmera:', e);
    }

    try {
      const fsStatus = await Filesystem.requestPermissions();
      storageGranted = fsStatus.publicStorage === 'granted';
    } catch (e) {
      console.warn('Aviso ao solicitar permissão de armazenamento:', e);
    }
  }

  return { camera: cameraGranted, storage: storageGranted };
}

/**
 * Verifica status de permissões no Android
 */
export async function checkAndroidPermissions(): Promise<{
  camera: boolean;
  storage: boolean;
}> {
  let cameraGranted = true;
  let storageGranted = true;

  if (isNativeMobile()) {
    try {
      const camStatus = await Camera.checkPermissions();
      cameraGranted = camStatus.camera === 'granted';
    } catch {
      cameraGranted = false;
    }

    try {
      const fsStatus = await Filesystem.checkPermissions();
      storageGranted = fsStatus.publicStorage === 'granted';
    } catch {
      storageGranted = false;
    }
  }

  return { camera: cameraGranted, storage: storageGranted };
}

/**
 * Normaliza qualquer dado de imagem (DataURL, Base64 puro, URL blob, path) para Base64 puro
 */
export async function normalizeToBase64(photoData: string | undefined | null): Promise<string> {
  if (!photoData || typeof photoData !== 'string') return '';
  const trimmed = photoData.trim();
  if (!trimmed) return '';

  // 1. Data URL (data:image/...;base64,XXXX)
  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    return commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : trimmed;
  }

  // 2. Base64 puro
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy') || (trimmed.length > 200 && !trimmed.includes('/'))) {
    return trimmed;
  }

  // 3. Caminho resolvido ou URL
  try {
    const resolvedUrl = resolvePhotoSrc(trimmed);
    if (resolvedUrl.startsWith('data:')) {
      const commaIndex = resolvedUrl.indexOf(',');
      return commaIndex !== -1 ? resolvedUrl.slice(commaIndex + 1) : resolvedUrl;
    }
    const res = await fetch(resolvedUrl);
    if (res.ok) {
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const commaIndex = result.indexOf(',');
          resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn('Erro ao normalizar imagem para Base64:', e);
  }

  return '';
}

export interface RegistroFotosInput {
  foto1?: string;
  foto2?: string;
  foto3?: string;
  foto4?: string;
}

export interface PhotoSaveStatus {
  index: 1 | 2 | 3 | 4;
  label: string;
  fileName: string;
  success: boolean;
  path?: string;
  size?: number;
  error?: string;
}

export interface SaveFotosResult {
  success: boolean;
  folderPath: string;
  photos: {
    foto1: PhotoSaveStatus;
    foto2: PhotoSaveStatus;
    foto3: PhotoSaveStatus;
    foto4: PhotoSaveStatus;
  };
  failedCount: number;
  failedMessages: string[];
}

/**
 * Cria previamente a pasta de destino única evitando condições de corrida
 */
export async function ensureRegistroFolderExists(
  cleanId: string,
  cleanPlaca: string
): Promise<{ baseDir: Directory; activeFolder: string }> {
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const targetFolder = `${ROOT_PHOTOS_DIR}/${folderTag}`;
  const fallbackFolder = `${ROOT_DOCUMENTS_PHOTOS_DIR}/${folderTag}`;

  if (!isNativeMobile()) {
    return { baseDir: Directory.Documents, activeFolder: targetFolder };
  }

  // Tenta criar primeiro em ExternalStorage (Download público)
  try {
    await Filesystem.mkdir({
      path: targetFolder,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
    return { baseDir: Directory.ExternalStorage, activeFolder: targetFolder };
  } catch (extErr) {
    console.warn(`Tentativa em ExternalStorage falhou, usando Documents para ${folderTag}:`, extErr);
    try {
      await Filesystem.mkdir({
        path: fallbackFolder,
        directory: Directory.Documents,
        recursive: true,
      });
      return { baseDir: Directory.Documents, activeFolder: fallbackFolder };
    } catch (docErr) {
      console.error(`Erro crítico ao criar diretório ${folderTag} no celular:`, docErr);
      throw new Error(`Não foi possível criar o diretório no celular: ${docErr}`);
    }
  }
}

/**
 * Salva as 4 fotos no celular com validação física individual via Filesystem.stat()
 * Elimina condição de corrida criando a pasta primeiro e salvando com confirmação de tamanho real em disco.
 */
export async function saveAllPhotosToMobile(
  id: string,
  placa: string,
  fotos: RegistroFotosInput | (string | undefined)[]
): Promise<SaveFotosResult> {
  const cleanId = String(id).trim();
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  let f1: string | undefined;
  let f2: string | undefined;
  let f3: string | undefined;
  let f4: string | undefined;

  if (Array.isArray(fotos)) {
    [f1, f2, f3, f4] = fotos;
  } else {
    f1 = fotos.foto1;
    f2 = fotos.foto2;
    f3 = fotos.foto3;
    f4 = fotos.foto4;
  }

  const entries: { index: 1 | 2 | 3 | 4; label: string; data?: string; fileName: string }[] = [
    { index: 1, label: 'Foto 1 (Frente)', data: f1, fileName: `${folderTag}_foto1.jpg` },
    { index: 2, label: 'Foto 2 (Traseira)', data: f2, fileName: `${folderTag}_foto2.jpg` },
    { index: 3, label: 'Foto 3 (CNH)', data: f3, fileName: `${folderTag}_foto3.jpg` },
    { index: 4, label: 'Foto 4 (CRLV)', data: f4, fileName: `${folderTag}_foto4.jpg` },
  ];

  const photoResults: Record<string, PhotoSaveStatus> = {};
  const failedMessages: string[] = [];

  // Passo 1: Cria/Verifica a pasta única antes de iniciar as gravações
  let baseDir = Directory.ExternalStorage;
  let activeFolder = `${ROOT_PHOTOS_DIR}/${folderTag}`;

  if (isNativeMobile()) {
    try {
      const folderRes = await ensureRegistroFolderExists(cleanId, cleanPlaca);
      baseDir = folderRes.baseDir;
      activeFolder = folderRes.activeFolder;
    } catch (err: any) {
      const errMsg = `Falha ao criar pasta para ${folderTag}: ${err.message || err}`;
      return {
        success: false,
        folderPath: activeFolder,
        photos: {
          foto1: { index: 1, label: 'Foto 1 (Frente)', fileName: `${folderTag}_foto1.jpg`, success: false, error: errMsg },
          foto2: { index: 2, label: 'Foto 2 (Traseira)', fileName: `${folderTag}_foto2.jpg`, success: false, error: errMsg },
          foto3: { index: 3, label: 'Foto 3 (CNH)', fileName: `${folderTag}_foto3.jpg`, success: false, error: errMsg },
          foto4: { index: 4, label: 'Foto 4 (CRLV)', fileName: `${folderTag}_foto4.jpg`, success: false, error: errMsg },
        },
        failedCount: 4,
        failedMessages: [errMsg],
      };
    }
  }

  // Passo 2: Gravação e validação sequencial de cada uma das 4 fotos
  for (const item of entries) {
    if (!item.data || !item.data.trim()) {
      photoResults[`foto${item.index}`] = {
        index: item.index,
        label: item.label,
        fileName: item.fileName,
        success: false,
        error: `${item.label} não informada.`,
      };
      failedMessages.push(`${item.label} não informada.`);
      continue;
    }

    try {
      const cleanB64 = await normalizeToBase64(item.data);
      if (!cleanB64) {
        photoResults[`foto${item.index}`] = {
          index: item.index,
          label: item.label,
          fileName: item.fileName,
          success: false,
          error: `Não foi possível converter dados de ${item.label} para Base64.`,
        };
        failedMessages.push(`Não foi possível converter dados de ${item.label}.`);
        continue;
      }

      // Salva no cache do IndexedDB para renderização offline imediata
      const relativePath = `RegistroFotos/${folderTag}/${item.fileName}`;
      await setCachedPhoto(relativePath, `data:image/jpeg;base64,${cleanB64}`);

      if (isNativeMobile()) {
        const filePath = `${activeFolder}/${item.fileName}`;

        // Grava fisicamente no disco
        const writeResult = await Filesystem.writeFile({
          path: filePath,
          data: cleanB64,
          directory: baseDir,
          recursive: true,
        });

        // Passo 3: Validação física com stat() garantindo que o arquivo existe e tem tamanho > 0
        try {
          const stat = await Filesystem.stat({
            path: filePath,
            directory: baseDir,
          });

          if (stat && stat.size > 0) {
            photoResults[`foto${item.index}`] = {
              index: item.index,
              label: item.label,
              fileName: item.fileName,
              success: true,
              path: writeResult.uri || stat.uri,
              size: stat.size,
            };
          } else {
            photoResults[`foto${item.index}`] = {
              index: item.index,
              label: item.label,
              fileName: item.fileName,
              success: false,
              error: `Arquivo físico de ${item.label} foi gravado mas possui 0 bytes.`,
            };
            failedMessages.push(`Arquivo de ${item.label} possui 0 bytes.`);
          }
        } catch (statErr: any) {
          // Se stat falhar, tenta verificar fallback no Documents
          photoResults[`foto${item.index}`] = {
            index: item.index,
            label: item.label,
            fileName: item.fileName,
            success: false,
            error: `Validação física de ${item.label} falhou: ${statErr.message || statErr}`,
          };
          failedMessages.push(`Validação de ${item.label} falhou no disco.`);
        }
      } else {
        // Ambiente Web / Navegador
        photoResults[`foto${item.index}`] = {
          index: item.index,
          label: item.label,
          fileName: item.fileName,
          success: true,
          path: `${activeFolder}/${item.fileName}`,
          size: cleanB64.length,
        };
      }
    } catch (writeErr: any) {
      const errDetail = `Erro ao salvar ${item.label}: ${writeErr.message || writeErr}`;
      console.error(errDetail);
      photoResults[`foto${item.index}`] = {
        index: item.index,
        label: item.label,
        fileName: item.fileName,
        success: false,
        error: errDetail,
      };
      failedMessages.push(errDetail);
    }
  }

  const successCount = Object.values(photoResults).filter(p => p.success).length;

  return {
    success: successCount === 4,
    folderPath: activeFolder,
    photos: {
      foto1: photoResults.foto1,
      foto2: photoResults.foto2,
      foto3: photoResults.foto3,
      foto4: photoResults.foto4,
    },
    failedCount: 4 - successCount,
    failedMessages,
  };
}

/**
 * Função legada mantida para compatibilidade
 */
export async function savePhotoToMobileDownload(
  recordId: string,
  placa: string,
  photoIndex: 1 | 2 | 3 | 4,
  base64Data: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const fotos: RegistroFotosInput = {};
  if (photoIndex === 1) fotos.foto1 = base64Data;
  if (photoIndex === 2) fotos.foto2 = base64Data;
  if (photoIndex === 3) fotos.foto3 = base64Data;
  if (photoIndex === 4) fotos.foto4 = base64Data;

  const res = await saveAllPhotosToMobile(recordId, placa, fotos);
  const item = res.photos[`foto${photoIndex}`];
  return {
    success: Boolean(item?.success),
    path: item?.path,
    error: item?.error,
  };
}

/**
 * Exclui a pasta física da vistoria e todos os seus 4 arquivos do celular
 */
export async function deleteRegistroFolderAndPhotos(id: string, placa: string): Promise<void> {
  const cleanId = String(id).trim();
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  // Limpa cache IndexedDB
  await deleteCachedPhoto(`RegistroFotos/${folderTag}/${folderTag}_foto1.jpg`);
  await deleteCachedPhoto(`RegistroFotos/${folderTag}/${folderTag}_foto2.jpg`);
  await deleteCachedPhoto(`RegistroFotos/${folderTag}/${folderTag}_foto3.jpg`);
  await deleteCachedPhoto(`RegistroFotos/${folderTag}/${folderTag}_foto4.jpg`);

  if (isNativeMobile()) {
    try {
      await Filesystem.rmdir({
        path: `${ROOT_PHOTOS_DIR}/${folderTag}`,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch {}

    try {
      await Filesystem.rmdir({
        path: `${ROOT_DOCUMENTS_PHOTOS_DIR}/${folderTag}`,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {}
  }
}

/**
 * Formata os registros no padrão oficial unificado: ID,Placa,Status,Data,Fotos
 * Com as 4 referências exatas na coluna Fotos
 */
export function formatRegistrosToCsv(records: Registro[]): string {
  const header = CSV_HEADER;
  const rows = records.map(r => {
    const dataStr = r.hora ? `${r.dia} ${r.hora}` : r.dia;
    const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanId = String(r.id).trim();
    const folderTag = `(${cleanId}_${cleanPlaca})`;
    const fotosArr: string[] = [
      `${folderTag}_foto1.jpg`,
      `${folderTag}_foto2.jpg`,
      `${folderTag}_foto3.jpg`,
      `${folderTag}_foto4.jpg`,
    ];
    return `${cleanId},${cleanPlaca},${r.status},${dataStr},${fotosArr.join(';')}`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Grava o CSV unificado no armazenamento do dispositivo celular
 */
export async function writeRegistrosCsvToDevice(records: Registro[]): Promise<string> {
  const csvContent = formatRegistrosToCsv(records);

  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Erro ao atualizar localStorage:', e);
  }

  if (isNativeMobile()) {
    try {
      await Filesystem.writeFile({
        path: `Download/${CSV_FILENAME}`,
        data: csvContent,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch (extErr) {
      console.warn('Gravação em Download/Registros.csv falhou, tentando Documents:', extErr);
      try {
        await Filesystem.writeFile({
          path: CSV_FILENAME,
          data: csvContent,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (docErr) {
        console.error('Falha crítica ao gravar Registros.csv no celular:', docErr);
      }
    }
  }

  return csvContent;
}

/**
 * Lê o arquivo Registros.csv do dispositivo
 */
export async function readCsvFromDevice(): Promise<string> {
  if (isNativeMobile()) {
    try {
      const res = await Filesystem.readFile({
        path: `Download/${CSV_FILENAME}`,
        directory: Directory.ExternalStorage,
      });
      if (typeof res.data === 'string') return res.data;
    } catch {
      try {
        const res = await Filesystem.readFile({
          path: CSV_FILENAME,
          directory: Directory.Documents,
        });
        if (typeof res.data === 'string') return res.data;
      } catch {}
    }
  }

  const cached = localStorage.getItem(LOCALSTORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return formatRegistrosToCsv(parsed);
      }
    } catch {}
  }

  return `${CSV_HEADER}\n`;
}

/**
 * Retorna registros salvos para o Explorador de Pastas
 */
export async function listLocalFoldersAndFiles(): Promise<{
  folderName: string;
  folderPath: string;
  files: {
    fileName: string;
    filePath: string;
    url: string;
    size: number;
    modifiedAt: string;
  }[];
}[]> {
  let records: Registro[] = [];
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (raw) {
      records = JSON.parse(raw);
    }
  } catch {}

  const folderList = [];

  for (const r of records) {
    const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanId = String(r.id).trim();
    const folderName = `(${cleanId}_${cleanPlaca})`;
    const folderPath = `Download/RegistroFotos/${folderName}`;

    const files = [
      {
        fileName: `${folderName}_foto1.jpg`,
        filePath: `${folderPath}/${folderName}_foto1.jpg`,
        url: resolvePhotoSrc(r.foto1),
        size: 1024 * 160,
        modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
      },
      {
        fileName: `${folderName}_foto2.jpg`,
        filePath: `${folderPath}/${folderName}_foto2.jpg`,
        url: resolvePhotoSrc(r.foto2),
        size: 1024 * 160,
        modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
      },
      {
        fileName: `${folderName}_foto3.jpg`,
        filePath: `${folderPath}/${folderName}_foto3.jpg`,
        url: resolvePhotoSrc(r.foto3 || ''),
        size: 1024 * 160,
        modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
      },
      {
        fileName: `${folderName}_foto4.jpg`,
        filePath: `${folderPath}/${folderName}_foto4.jpg`,
        url: resolvePhotoSrc(r.foto4 || ''),
        size: 1024 * 160,
        modifiedAt: `${r.dia}T${r.hora || '12:00'}:00Z`,
      },
    ];

    folderList.push({
      folderName,
      folderPath,
      files,
    });
  }

  return folderList;
}

/**
 * Exporta o CSV gravado no celular
 */
export async function getExportCsvContent(): Promise<string> {
  let records: Registro[] = [];
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (raw) {
      records = JSON.parse(raw);
    }
  } catch {}
  return formatRegistrosToCsv(records);
}

/**
 * Validação prévia estrita das 4 fotos antes de permitir o compartilhamento
 * Se alguma foto estiver ausente ou corrompida, retorna o erro específico indicando exatamente qual falhou.
 */
export async function validateAndPrepareSharePhotos(registro: Registro): Promise<{
  valid: boolean;
  uris: string[];
  files: File[];
  error?: string;
}> {
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;

  const photoConfigs = [
    { index: 1, label: 'Foto 1 (Frente)', data: registro.foto1, fileName: `share_${folderTag}_foto1.jpg`, originalName: `${folderTag}_foto1.jpg` },
    { index: 2, label: 'Foto 2 (Traseira)', data: registro.foto2, fileName: `share_${folderTag}_foto2.jpg`, originalName: `${folderTag}_foto2.jpg` },
    { index: 3, label: 'Foto 3 (CNH)', data: registro.foto3, fileName: `share_${folderTag}_foto3.jpg`, originalName: `${folderTag}_foto3.jpg` },
    { index: 4, label: 'Foto 4 (CRLV)', data: registro.foto4, fileName: `share_${folderTag}_foto4.jpg`, originalName: `${folderTag}_foto4.jpg` },
  ];

  // 1. Verifica se todas as 4 fotos existem no registro
  for (const cfg of photoConfigs) {
    if (!cfg.data || !cfg.data.trim()) {
      return {
        valid: false,
        uris: [],
        files: [],
        error: `Não foi possível preparar a ${cfg.label} para compartilhamento: imagem não encontrada no registro.`,
      };
    }
  }

  const uris: string[] = [];
  const files: File[] = [];

  // 2. Prepara arquivos temporários validados no cache do dispositivo
  for (const cfg of photoConfigs) {
    try {
      const cleanB64 = await normalizeToBase64(cfg.data);
      if (!cleanB64) {
        return {
          valid: false,
          uris: [],
          files: [],
          error: `Não foi possível preparar a ${cfg.label} para compartilhamento: dados inválidos.`,
        };
      }

      if (isNativeMobile()) {
        const writeRes = await Filesystem.writeFile({
          path: cfg.fileName,
          data: cleanB64,
          directory: Directory.Cache,
          recursive: true,
        });

        // Valida com stat se o arquivo temporário existe no cache
        const stat = await Filesystem.stat({
          path: cfg.fileName,
          directory: Directory.Cache,
        });

        if (!stat || stat.size === 0) {
          return {
            valid: false,
            uris: [],
            files: [],
            error: `Não foi possível preparar a ${cfg.label} para compartilhamento no cache do aparelho.`,
          };
        }

        uris.push(writeRes.uri || stat.uri);
      }

      // Prepara objeto File para navegadores
      const bstr = atob(cleanB64);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: 'image/jpeg' });
      files.push(new File([blob], cfg.originalName, { type: 'image/jpeg' }));
    } catch (prepErr: any) {
      return {
        valid: false,
        uris: [],
        files: [],
        error: `Erro ao preparar a ${cfg.label} para compartilhamento: ${prepErr.message || prepErr}`,
      };
    }
  }

  return {
    valid: true,
    uris,
    files,
  };
}

/**
 * Sincroniza todas as fotos para a pasta Download do celular ou emite ZIP
 */
export async function syncAllFoldersToMobileDownload(
  registros: Registro[],
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: boolean; message: string; savedCount: number }> {
  let savedCount = 0;
  const totalSteps = registros.length * 4;

  if (isNativeMobile()) {
    try {
      onProgress?.(0, totalSteps, 'Criando pasta raiz Download/RegistroFotos...');

      for (let i = 0; i < registros.length; i++) {
        const r = registros[i];
        onProgress?.(i * 4 + 1, totalSteps, `Salvando fotos do registro #${r.id} (${r.placa})...`);

        const res = await saveAllPhotosToMobile(r.id, r.placa, {
          foto1: r.foto1,
          foto2: r.foto2,
          foto3: r.foto3,
          foto4: r.foto4,
        });

        savedCount += Object.values(res.photos).filter(p => p.success).length;
      }

      return {
        success: true,
        message: `${savedCount} fotos organizadas em suas respectivas subpastas criadas em Download/RegistroFotos/ no celular!`,
        savedCount,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Erro durante sincronização com a pasta Download: ' + err.message,
        savedCount,
      };
    }
  }

  // Fallback web: ZIP com as 4 fotos
  try {
    onProgress?.(1, 2, 'Compactando fotos no navegador...');
    const JSZipModule = (await import('jszip')).default;
    const zip = new JSZipModule();
    const rootFolder = zip.folder('RegistroFotos');

    for (const r of registros) {
      const cleanPlaca = r.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const folderTag = `(${r.id}_${cleanPlaca})`;
      const sub = rootFolder?.folder(folderTag);

      const addZipPhoto = async (photoData: string | undefined, name: string) => {
        if (!photoData) return;
        const b64 = await normalizeToBase64(photoData);
        if (b64) {
          sub?.file(name, b64, { base64: true });
          savedCount++;
        }
      };

      await Promise.all([
        addZipPhoto(r.foto1, `${folderTag}_foto1.jpg`),
        addZipPhoto(r.foto2, `${folderTag}_foto2.jpg`),
        addZipPhoto(r.foto3, `${folderTag}_foto3.jpg`),
        addZipPhoto(r.foto4, `${folderTag}_foto4.jpg`),
      ]);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RegistroFotos_Download.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'Download concluído! O arquivo "RegistroFotos_Download.zip" com todas as fotos foi gravado no dispositivo.',
      savedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Erro ao transferir arquivos: ' + err.message,
      savedCount: 0,
    };
  }
}

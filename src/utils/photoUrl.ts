import { Capacitor } from '@capacitor/core';

/**
 * Converte qualquer caminho ou dado de foto em uma URL válida para a tag <img>
 * 
 * 1. Caso a foto esteja em formato Base64 (data:image/...):
 *    Garante que a tag <img> receba diretamente o atributo src="data:image/jpeg;base64,..."
 *    sem prefixos de URL de localhost.
 * 
 * 2. Caso a foto seja um caminho local no celular Android (ex: file://, /storage/...):
 *    Converte usando Capacitor.convertFileSrc(path) do @capacitor/core para uma URL
 *    válida legível pelo WebView do Android (ex: https://localhost/_capacitor_file_/).
 */
export function resolvePhotoSrc(rawPathOrData?: string | null): string {
  if (!rawPathOrData) return '';
  const trimmed = rawPathOrData.trim();
  if (!trimmed) return '';

  // 1. Se já for Base64 (data:image/...), retorna diretamente sem prefixos
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
    return trimmed;
  }

  // 1.1 Se for Base64 puro (sem o prefixo data:)
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  // 2. Se for URL externa web (http, https) ou Blob URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 3. Se for caminho local no dispositivo móvel / Android Capacitor
  try {
    // Se for URI nativo ou caminho absoluto no sistema de arquivos do Android
    if (
      trimmed.startsWith('file://') || 
      trimmed.startsWith('/storage/') || 
      trimmed.startsWith('content://') ||
      trimmed.startsWith('/')
    ) {
      return Capacitor.convertFileSrc(trimmed);
    }

    // Se for caminho relativo na pasta pública do Android (Download ou Documents)
    if (Capacitor.isNativePlatform()) {
      if (trimmed.startsWith('Download/') || trimmed.startsWith('RegistroFotos/')) {
        const fullAndroidPath = `/storage/emulated/0/${trimmed}`;
        return Capacitor.convertFileSrc(fullAndroidPath);
      }
      return Capacitor.convertFileSrc(trimmed);
    }
  } catch (err) {
    console.warn('Erro ao converter caminho de arquivo via Capacitor.convertFileSrc:', err);
  }

  // Fallback padrão
  return trimmed;
}

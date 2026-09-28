import { Registro } from '../types';
import { isNativeMobile, validateAndPrepareSharePhotos } from './storageService';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';
import { Share } from '@capacitor/share';
import { registerPlugin } from '@capacitor/core';

interface NativeMultipleSharePlugin {
  shareFiles(options: {
    files: string[];
    title?: string;
    text?: string;
    dialogTitle?: string;
  }): Promise<{ success: boolean; sharedCount: number }>;
}

// Plugin nativo customizado no Android com ACTION_SEND_MULTIPLE, ClipData e FLAG_GRANT_READ_URI_PERMISSION
const NativeMultipleShare = registerPlugin<NativeMultipleSharePlugin>('NativeMultipleShare');

/**
 * Formata o relatório de vistoria veicular exatamente conforme a especificação:
 *
 * 🚗 *RELATÓRIO DE VISTORIA VEICULAR*
 * ___________________________________
 *
 * 📋 *ID do Registro:* #{id}
 * 🛡️ *Nome Blitz:* {nomeBlitz}
 * 🛞 *Placa:* {placa}
 * 📅 *Data:* {dia}
 * ⏰ *Hora:* {hora}
 * ❌ *Status:* {status} (usar ❌ para REPROVADO, ✅ para APROVADO, ⏳ para Teste Em Andamento)
 * ___________________________________
 *
 * _Emitido via Sistema de Vistorias e Registros._
 */
export function generateWhatsAppReportText(registro: Registro): string {
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const blitzNome = registro.nomeBlitz || 'Não informada';

  let statusEmoji = '⏳';
  if (registro.status === 'APROVADO') {
    statusEmoji = '✅';
  } else if (registro.status === 'REPROVADO') {
    statusEmoji = '❌';
  }

  return `🚗 *RELATÓRIO DE VISTORIA VEICULAR*
___________________________________

📋 *ID do Registro:* #${cleanId}
🛡️ *Nome Blitz:* ${blitzNome}
🛞 *Placa:* ${cleanPlaca}
📅 *Data:* ${registro.dia}
⏰ *Hora:* ${registro.hora || '--:--'}
${statusEmoji} *Status:* ${registro.status}
___________________________________

_Emitido via Sistema de Vistorias e Registros._`;
}

export interface ShareVistoriaResult {
  success: boolean;
  sharedDirectly: boolean;
  needsPrompt: boolean;
  messageText: string;
  error?: string;
  pdfBlob?: Blob;
  pdfFileName?: string;
}

/**
 * Envia a vistoria completa (Relatório + As 4 Fotos Reais) via WhatsApp usando intent nativa
 * Valida rigorosamente as 4 fotos antes de disparar o compartilhamento
 */
export async function sendRegistroToWhatsApp(registro: Registro): Promise<ShareVistoriaResult> {
  const messageText = generateWhatsAppReportText(registro);
  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Validação estrita das 4 fotos: se alguma estiver ausente ou inválida, interrompe e avisa
  const validation = await validateAndPrepareSharePhotos(registro);
  if (!validation.valid || validation.uris.length < 4 && isNativeMobile()) {
    return {
      success: false,
      sharedDirectly: false,
      needsPrompt: false,
      messageText,
      error: validation.error || 'Não foi possível preparar todas as 4 fotos para o compartilhamento.',
    };
  }

  // 2. Sempre copia o relatório formatado para a área de transferência como garantia (Requisito 12)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(messageText);
    }
  } catch (clipErr) {
    console.warn('Clipboard writeText indisponível:', clipErr);
  }

  // 3. Compartilhamento Nativo no Android / iOS
  if (isNativeMobile()) {
    // Tentativa 1: Plugin Nativo Android Customizado com ACTION_SEND_MULTIPLE, ClipData e FLAG_GRANT_READ_URI_PERMISSION
    try {
      const nativeRes = await NativeMultipleShare.shareFiles({
        files: validation.uris,
        title: `Vistoria - Placa ${cleanPlaca}`,
        text: messageText,
        dialogTitle: `Enviar Vistoria - Placa ${cleanPlaca}`,
      });

      if (nativeRes && nativeRes.success) {
        return {
          success: true,
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (pluginErr: any) {
      console.warn('NativeMultipleShare indisponível ou falhou, tentando fallback com @capacitor/share:', pluginErr);
    }

    // Tentativa 2: Plugin oficial @capacitor/share
    try {
      await Share.share({
        title: `Vistoria - Placa ${cleanPlaca}`,
        text: messageText,
        files: validation.uris,
        dialogTitle: `Enviar Vistoria - Placa ${cleanPlaca}`,
      });

      return {
        success: true,
        sharedDirectly: true,
        needsPrompt: false,
        messageText,
      };
    } catch (capErr: any) {
      if (capErr?.message?.includes('canceled') || capErr?.message?.includes('cancel')) {
        return {
          success: true,
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
      console.warn('Capacitor Share falhou:', capErr);
    }
  }

  // 4. Navegador Web com Web Share API que suporta compartilhamento de múltiplos arquivos
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const canShare =
        validation.files.length === 4 &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: validation.files });

      if (canShare) {
        await navigator.share({
          files: validation.files,
          text: messageText,
          title: `Vistoria - Placa ${cleanPlaca}`,
        });

        return {
          success: true,
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
    } catch (webErr: any) {
      if (webErr?.name === 'AbortError') {
        return {
          success: true,
          sharedDirectly: true,
          needsPrompt: false,
          messageText,
        };
      }
      console.warn('Web Share API falhou:', webErr);
    }
  }

  // 5. Método Fallback Web: Gera o Laudo PDF com as 4 fotos, abre o WhatsApp com texto e abre modal orientador
  let pdfBlob: Blob | undefined;
  let pdfFileName: string | undefined;

  try {
    const pdfRes = await generateVehicleReportPDF(registro);
    pdfBlob = pdfRes.blob;
    pdfFileName = pdfRes.fileName;
  } catch (pdfErr) {
    console.warn('Erro ao gerar laudo PDF no fallback:', pdfErr);
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
  window.open(whatsappUrl, '_blank');

  return {
    success: true,
    sharedDirectly: false,
    needsPrompt: true,
    messageText,
    pdfBlob,
    pdfFileName,
  };
}

export const compartilharVistoria = sendRegistroToWhatsApp;

import { jsPDF } from 'jspdf';
import { Registro } from '../types';
import { resolvePhotoSrc } from './photoUrl';

// Helper to convert an image URL or relative path into a Base64 data string for jsPDF
async function loadImageAsBase64(url: string | undefined): Promise<string | null> {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  try {
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    if (trimmed.startsWith('/9j/') || trimmed.startsWith('iVBORw0KGgo') || trimmed.startsWith('PHN2Zy')) {
      return `data:image/jpeg;base64,${trimmed}`;
    }

    const resolved = resolvePhotoSrc(trimmed);
    if (resolved.startsWith('data:image/')) {
      return resolved;
    }

    const cleanUrl = resolved.startsWith('/') ? resolved : `/${resolved}`;
    const response = await fetch(cleanUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Não foi possível carregar a imagem para o PDF:', err);
    return null;
  }
}

export async function generateVehicleReportPDF(registro: Registro): Promise<{ doc: jsPDF; blob: Blob; fileName: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isAprovado = registro.status === 'APROVADO';
  const isReprovado = registro.status === 'REPROVADO';
  const primaryColor = isAprovado ? [22, 101, 52] : isReprovado ? [153, 27, 27] : [180, 83, 9];
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanId = String(registro.id).trim();
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const fileName = `Vistoria_${cleanPlaca}_ID${cleanId}.pdf`;

  // Top Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 25, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE VISTORIA VEICULAR', 105, 11, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('SISTEMA INTEGRADO DE REGISTRO, INSPEÇÃO E CONTROLE', 105, 18, { align: 'center' });

  // Status Stamp Box
  const statusBoxY = 30;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.7);
  doc.setFillColor(isAprovado ? 240 : 254, isAprovado ? 253 : 242, isAprovado ? 244 : 242);
  doc.roundedRect(14, statusBoxY, 182, 18, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text('RESULTADO DA AVALIAÇÃO TÉCNICA:', 20, statusBoxY + 11.5);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(registro.status, 190, statusBoxY + 12.5, { align: 'right' });

  // Vehicle Information Grid
  const gridY = 52;
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, gridY, 182, 36, 2, 2, 'FD');

  // Field: ID
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ID REGISTRO', 20, gridY + 8);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`#${cleanId}`, 20, gridY + 16);

  // Field: Placa
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PLACA DO VEÍCULO', 65, gridY + 8);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(cleanPlaca, 65, gridY + 16);

  // Field: Data
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA DA VISTORIA', 125, gridY + 8);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(registro.dia, 125, gridY + 16);

  // Field: Hora
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('HORA DO REGISTRO', 20, gridY + 25);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(registro.hora || '--:--', 20, gridY + 32);

  // Field: Blitz
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('OPERAÇÃO / BLITZ', 65, gridY + 25);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(registro.nomeBlitz || '—', 65, gridY + 32);

  // Field: Emissão
  const now = new Date();
  const emitidoEm = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('EMISSÃO DO LAUDO', 125, gridY + 25);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(emitidoEm, 125, gridY + 32);

  // Section: Photos Title
  const photoSectionY = 94;
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('REGISTRO FOTOGRÁFICO OBRIGATÓRIO (4 FOTOS)', 14, photoSectionY);

  // Load 4 photos in parallel
  const [foto1Base64, foto2Base64, foto3Base64, foto4Base64] = await Promise.all([
    loadImageAsBase64(registro.foto1),
    loadImageAsBase64(registro.foto2),
    loadImageAsBase64(registro.foto3),
    loadImageAsBase64(registro.foto4),
  ]);

  const imgWidth = 86;
  const imgHeight = 48;
  const row1Y = photoSectionY + 4;
  const row2Y = row1Y + imgHeight + 11;

  const renderPhotoSlot = (
    base64: string | null,
    x: number,
    y: number,
    label: string,
    fileName: string
  ) => {
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, y, imgWidth, imgHeight, 2, 2, 'FD');

    if (base64) {
      try {
        doc.addImage(base64, 'JPEG', x + 1, y + 1, imgWidth - 2, imgHeight - 2);
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x + imgWidth / 2, y + imgHeight / 2, { align: 'center' });
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${label} não anexada`, x + imgWidth / 2, y + imgHeight / 2, { align: 'center' });
    }

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`${label}: ${fileName}`, x, y + imgHeight + 5);
  };

  // Row 1: Foto 1 e Foto 2 (Veículo)
  renderPhotoSlot(foto1Base64, 14, row1Y, 'FOTO 1 (FRENTE)', `${folderTag}_foto1.jpg`);
  renderPhotoSlot(foto2Base64, 110, row1Y, 'FOTO 2 (TRASEIRA)', `${folderTag}_foto2.jpg`);

  // Row 2: Foto 3 e Foto 4 (Documentos)
  renderPhotoSlot(foto3Base64, 14, row2Y, 'FOTO 3 (CNH)', `${folderTag}_foto3.jpg`);
  renderPhotoSlot(foto4Base64, 110, row2Y, 'FOTO 4 (CRLV)', `${folderTag}_foto4.jpg`);

  // Storage confirmation notes
  const footerNoteY = row2Y + imgHeight + 9;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerNoteY, 196, footerNoteY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`Pasta física das fotos: Download/RegistroFotos/${folderTag}/`, 14, footerNoteY + 5);
  doc.text('Documento gerado eletronicamente com validação de conformidade técnica e fé pública.', 14, footerNoteY + 9.5);

  // Signatures
  const sigY = 248;
  doc.setDrawColor(148, 163, 184);
  doc.line(20, sigY, 90, sigY);
  doc.line(120, sigY, 190, sigY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Assinatura do Vistoriador Responsável', 55, sigY + 4.5, { align: 'center' });
  doc.text('Responsável pelo Recebimento / Cliente', 155, sigY + 4.5, { align: 'center' });

  // Footer banner
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 284, 210, 13, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Página 1 de 1 • Registro #${cleanId} • Placa ${cleanPlaca}`, 105, 291, { align: 'center' });

  const blob = doc.output('blob');
  return { doc, blob, fileName };
}

import { sendRegistroToWhatsApp } from '../services/whatsappService';

export async function shareViaWhatsApp(registro: Registro): Promise<{
  success: boolean;
  method: 'native' | 'whatsapp-web' | 'cancelled';
  message?: string;
}> {
  const result = await sendRegistroToWhatsApp(registro);
  return {
    success: true,
    method: result.sharedDirectly ? 'native' : 'whatsapp-web',
    message: result.sharedDirectly
      ? 'Vistoria e fotos compartilhadas com sucesso!'
      : 'WhatsApp aberto com o relatório da vistoria!',
  };
}

import React, { useState } from 'react';
import { Registro } from '../types';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Folder, 
  Download, 
  MessageCircle, 
  FileText,
  CheckCircle2,
  FileCheck,
  Car,
  Image as ImageIcon
} from 'lucide-react';

interface WhatsAppPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  registro: Registro | null;
  reportText: string;
  pdfBlob?: Blob;
  pdfFileName?: string;
}

export function WhatsAppPromptModal({
  isOpen,
  onClose,
  registro,
  reportText,
  pdfBlob: initialPdfBlob,
  pdfFileName: initialPdfFileName,
}: WhatsAppPromptModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen || !registro) return null;

  const cleanId = String(registro.id).trim();
  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const folderPath = `Download/RegistroFotos/${folderTag}/`;

  const foto1FileName = `${folderTag}_foto1.jpg`;
  const foto2FileName = `${folderTag}_foto2.jpg`;
  const foto3FileName = `${folderTag}_foto3.jpg`;
  const foto4FileName = `${folderTag}_foto4.jpg`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = reportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleReopenWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      let blob = initialPdfBlob;
      let fileName = initialPdfFileName || `Vistoria_${cleanPlaca}_ID${cleanId}.pdf`;

      if (!blob) {
        const generated = await generateVehicleReportPDF(registro);
        blob = generated.blob;
        fileName = generated.fileName;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setActionNotice('Laudo PDF baixado! Você pode anexá-lo na conversa do WhatsApp.');
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      alert('Erro ao baixar PDF: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadAllPhotos = async () => {
    try {
      setDownloadingPhotos(true);
      const downloadSingle = (url: string, name: string) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      if (registro.foto1) {
        downloadSingle(resolvePhotoSrc(registro.foto1), foto1FileName);
      }
      if (registro.foto2) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto2), foto2FileName), 200);
      }
      if (registro.foto3) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto3), foto3FileName), 400);
      }
      if (registro.foto4) {
        setTimeout(() => downloadSingle(resolvePhotoSrc(registro.foto4), foto4FileName), 600);
      }

      setActionNotice('As 4 fotos foram enviadas para a pasta de Downloads do dispositivo!');
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      alert('Erro ao baixar fotos: ' + err.message);
    } finally {
      setDownloadingPhotos(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Envio via WhatsApp
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Vistoria #{cleanId} • Placa {cleanPlaca}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Status Alert */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-xs sm:text-sm text-emerald-900">
                O WhatsApp foi aberto com o relatório da vistoria!
              </p>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Para enviar a vistoria completa na conversa, anexe o <strong>Laudo PDF</strong> com as 4 fotos ou selecione as <strong>4 fotos salvas</strong> na pasta local.
              </p>
            </div>
          </div>

          {actionNotice && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Opção 1: Anexar Laudo PDF com 4 fotos */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-xs sm:text-sm text-indigo-950">
                  Opção Recomendada: Laudo Técnico em PDF
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                4 Fotos Inclusas
              </span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              O laudo contém os dados da blitz, status da avaliação e as 4 fotos em alta definição com validação técnica.
            </p>
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Baixar Laudo PDF da Vistoria</span>
              </button>
            </div>
          </div>

          {/* Opção 2: Fotos Salvas na Pasta do Celular */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>Pasta das 4 Fotos no Aparelho</span>
              </h3>
              <button
                type="button"
                onClick={handleDownloadAllPhotos}
                disabled={downloadingPhotos}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Baixar Fotos Novamente</span>
              </button>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-[11px] font-bold text-slate-800 break-all select-all flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{folderPath}</span>
            </div>

            {/* Grid com visual das 4 fotos */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              {/* Foto 1 */}
              <div className="p-2 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {registro.foto1 ? (
                      <img src={resolvePhotoSrc(registro.foto1)} alt="F1" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">--</div>
                    )}
                  </div>
                  <span className="truncate font-semibold text-[11px]">1. Frente</span>
                </div>
                <span className={`text-[10px] font-bold ${registro.foto1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {registro.foto1 ? 'OK' : 'Pendente'}
                </span>
              </div>

              {/* Foto 2 */}
              <div className="p-2 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {registro.foto2 ? (
                      <img src={resolvePhotoSrc(registro.foto2)} alt="F2" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">--</div>
                    )}
                  </div>
                  <span className="truncate font-semibold text-[11px]">2. Traseira</span>
                </div>
                <span className={`text-[10px] font-bold ${registro.foto2 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {registro.foto2 ? 'OK' : 'Pendente'}
                </span>
              </div>

              {/* Foto 3 */}
              <div className="p-2 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {registro.foto3 ? (
                      <img src={resolvePhotoSrc(registro.foto3)} alt="F3" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">--</div>
                    )}
                  </div>
                  <span className="truncate font-semibold text-[11px]">3. CNH</span>
                </div>
                <span className={`text-[10px] font-bold ${registro.foto3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {registro.foto3 ? 'OK' : 'Pendente'}
                </span>
              </div>

              {/* Foto 4 */}
              <div className="p-2 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {registro.foto4 ? (
                      <img src={resolvePhotoSrc(registro.foto4)} alt="F4" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">--</div>
                    )}
                  </div>
                  <span className="truncate font-semibold text-[11px]">4. CRLV</span>
                </div>
                <span className={`text-[10px] font-bold ${registro.foto4 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {registro.foto4 ? 'OK' : 'Pendente'}
                </span>
              </div>
            </div>
          </div>

          {/* Pré-visualização do Relatório Formatado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600">
                Texto do Relatório Formatado:
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {reportText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Texto Copiado' : 'Copiar Relatório'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReopenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Reabrir WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Registro } from '../types';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { generateVehicleReportPDF } from '../utils/pdfGenerator';
import { saveAllPhotosToMobile } from '../utils/mobileStorage';
import { resolvePhotoSrc } from '../utils/photoUrl';
import { sendRegistroToWhatsApp } from '../services/whatsappService';
import { WhatsAppPromptModal } from './WhatsAppPromptModal';
import { 
  ArrowLeft, 
  Edit3, 
  Trash2, 
  FileText, 
  Share2, 
  Calendar, 
  Clock, 
  Folder, 
  CheckCircle2, 
  XCircle, 
  Download, 
  ZoomIn, 
  X, 
  AlertTriangle,
  Shield,
  Smartphone,
  FileCheck,
  MessageCircle
} from 'lucide-react';

interface RegistroDetailViewProps {
  registro: Registro;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

export function RegistroDetailView({ registro, onBack, onEdit, onDelete }: RegistroDetailViewProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [savingDownload, setSavingDownload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeZoomPhoto, setActiveZoomPhoto] = useState<{ url: string; title: string } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [whatsAppReportText, setWhatsAppReportText] = useState('');
  const [whatsAppPdfBlob, setWhatsAppPdfBlob] = useState<Blob | undefined>(undefined);
  const [whatsAppPdfFileName, setWhatsAppPdfFileName] = useState<string | undefined>(undefined);

  const cleanPlaca = registro.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanId = String(registro.id).trim();
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const relativeFolder = `Download/RegistroFotos/${folderTag}/`;

  const foto1FileName = `${folderTag}_foto1.jpg`;
  const foto2FileName = `${folderTag}_foto2.jpg`;
  const foto3FileName = `${folderTag}_foto3.jpg`;
  const foto4FileName = `${folderTag}_foto4.jpg`;

  const isAprovado = registro.status === 'APROVADO';
  const isReprovado = registro.status === 'REPROVADO';
  const isEmAndamento = registro.status === 'Teste Em Andamento';

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      const { doc, fileName } = await generateVehicleReportPDF(registro);
      doc.save(fileName);
      setNotification(`Relatório "${fileName}" gerado com sucesso!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  /**
   * ENVIO VIA WHATSAPP COM FOTOS E RELATÓRIO COMPLETO:
   * - Tenta anexo direto das imagens via Share API nativa (Capacitor/Web Share)
   * - Caso não suportado no ambiente, gera texto formatado, PDF oficial e aciona o prompt da pasta local
   */
  const handleShareWhatsApp = async () => {
    try {
      setSharingWhatsApp(true);
      const result = await sendRegistroToWhatsApp(registro);

      if (!result.success && result.error) {
        alert(result.error);
        return;
      }

      setWhatsAppReportText(result.messageText);
      if (result.pdfBlob) setWhatsAppPdfBlob(result.pdfBlob);
      if (result.pdfFileName) setWhatsAppPdfFileName(result.pdfFileName);

      if (result.needsPrompt) {
        setShowWhatsAppPrompt(true);
      } else {
        setNotification('Compartilhado com sucesso via WhatsApp com as 4 fotos anexadas!');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err: any) {
      alert('Erro ao compartilhar via WhatsApp: ' + (err.message || err));
    } finally {
      setSharingWhatsApp(false);
    }
  };

  const foto1Url = resolvePhotoSrc(registro.foto1);
  const foto2Url = resolvePhotoSrc(registro.foto2);
  const foto3Url = resolvePhotoSrc(registro.foto3 || '');
  const foto4Url = resolvePhotoSrc(registro.foto4 || '');

  const handleSaveToPhoneDownload = async () => {
    try {
      setSavingDownload(true);

      // Salva de forma garantida as 4 fotos no aparelho
      await saveAllPhotosToMobile(registro.id, registro.placa, {
        foto1: registro.foto1,
        foto2: registro.foto2,
        foto3: registro.foto3,
        foto4: registro.foto4,
      });

      // Dispara download individual se estiver no navegador
      const triggerDownload = (url: string, name: string) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      triggerDownload(foto1Url, foto1FileName);
      setTimeout(() => triggerDownload(foto2Url, foto2FileName), 200);
      if (foto3Url) setTimeout(() => triggerDownload(foto3Url, foto3FileName), 400);
      if (foto4Url) setTimeout(() => triggerDownload(foto4Url, foto4FileName), 600);

      setNotification(`Fotos salvas em Download/RegistroFotos/(${cleanId}_${cleanPlaca})/`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      alert('Erro ao salvar na pasta Download: ' + err.message);
    } finally {
      setSavingDownload(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await onDelete();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 text-xs sm:text-sm font-semibold border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs sm:text-sm font-semibold self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </button>

        {/* Primary Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Editar</span>
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Excluir</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {generatingPdf ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-emerald-400" />
            )}
            <span>Gerar Relatório PDF</span>
          </button>

          {/* Botão "Enviar via WhatsApp" */}
          <button
            id="btn-enviar-whatsapp"
            onClick={handleShareWhatsApp}
            disabled={sharingWhatsApp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            title="Enviar relatório da vistoria com fotos via WhatsApp"
          >
            {sharingWhatsApp ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            <span>Enviar via WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Vehicle Overview Header Card */}
      <div className={`p-6 rounded-2xl border bg-white shadow-xs ${
        isAprovado 
          ? 'border-emerald-200' 
          : isReprovado 
          ? 'border-rose-200' 
          : 'border-amber-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <VehiclePlateBadge placa={registro.placa} size="lg" />

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Registro #{registro.id}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-500 font-mono">
                  Registros.csv
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Vistoria Veicular - {registro.placa}
              </h1>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm sm:text-base font-extrabold tracking-wide uppercase self-start sm:self-auto shadow-xs ${
            isAprovado 
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
              : isReprovado
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}>
            {isAprovado && <CheckCircle2 className="w-5 h-5 text-emerald-700" />}
            {isReprovado && <XCircle className="w-5 h-5 text-rose-700" />}
            {isEmAndamento && <Clock className="w-5 h-5 text-amber-700" />}
            <span>STATUS: {registro.status}</span>
          </div>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
            <Shield className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nome Blitz</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900 truncate block" title={registro.nomeBlitz}>
              {registro.nomeBlitz || '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Data (DIA)</span>
            <span className="text-base font-extrabold text-slate-900 block">{registro.dia}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Horário (HORA)</span>
            <span className="text-base font-extrabold text-slate-900 block">{registro.hora}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
            <Folder className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pasta no Aparelho</span>
            <span className="text-xs font-mono font-bold text-slate-800 truncate block">
              {relativeFolder}
            </span>
          </div>
        </div>
      </div>

      {/* Photos Section: 4 Fotos (Frente, Atrás, CNH e CRLV) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Galeria de Fotos da Vistoria e Documentos
            </h2>
            <p className="text-xs text-slate-500">
              Fotos salvas no padrão <span className="font-mono text-slate-700">({registro.id}_{cleanPlaca})_fotoX.jpg</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              disabled={sharingWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Compartilhar fotos e vistoria no WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enviar via WhatsApp</span>
            </button>

            <button
              onClick={handleSaveToPhoneDownload}
              disabled={savingDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Salvar fotos na subpasta Download/RegistroFotos/ deste veículo no celular"
            >
              {savingDownload ? (
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Salvar Fotos no Aparelho</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Photo 1 Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Foto 1 (Frente)
              </span>
              <a
                href={foto1Url}
                download={foto1FileName}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                title="Baixar Foto 1"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>

            <div
              onClick={() => setActiveZoomPhoto({ url: foto1Url, title: 'Foto 1 - Frente' })}
              className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-xs"
            >
              {foto1Url ? (
                <img
                  src={foto1Url}
                  alt="Foto 1 Frente"
                  className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Sem foto</div>
              )}
              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                <ZoomIn className="w-5 h-5" />
                <span>Ampliar</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block truncate">{foto1FileName}</span>
          </div>

          {/* Photo 2 Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Foto 2 (Atrás)
              </span>
              <a
                href={foto2Url}
                download={foto2FileName}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                title="Baixar Foto 2"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>

            <div
              onClick={() => setActiveZoomPhoto({ url: foto2Url, title: 'Foto 2 - Atrás' })}
              className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-xs"
            >
              {foto2Url ? (
                <img
                  src={foto2Url}
                  alt="Foto 2 Atrás"
                  className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Sem foto</div>
              )}
              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                <ZoomIn className="w-5 h-5" />
                <span>Ampliar</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block truncate">{foto2FileName}</span>
          </div>

          {/* Photo 3: CNH */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Foto 3 (CNH)</span>
              </span>
              {foto3Url && (
                <a
                  href={foto3Url}
                  download={foto3FileName}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  title="Baixar Foto 3 (CNH)"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div
              onClick={() => foto3Url && setActiveZoomPhoto({ url: foto3Url, title: 'Foto 3 - CNH' })}
              className={`group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs ${
                foto3Url ? 'cursor-pointer' : 'opacity-60'
              }`}
            >
              {foto3Url ? (
                <>
                  <img
                    src={foto3Url}
                    alt="Foto 3 CNH"
                    className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                    <ZoomIn className="w-5 h-5" />
                    <span>Ampliar</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>Não cadastrada</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block truncate">{foto3FileName}</span>
          </div>

          {/* Photo 4: CRLV */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Foto 4 (CRLV)</span>
              </span>
              {foto4Url && (
                <a
                  href={foto4Url}
                  download={foto4FileName}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                  title="Baixar Foto 4 (CRLV)"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div
              onClick={() => foto4Url && setActiveZoomPhoto({ url: foto4Url, title: 'Foto 4 - CRLV' })}
              className={`group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs ${
                foto4Url ? 'cursor-pointer' : 'opacity-60'
              }`}
            >
              {foto4Url ? (
                <>
                  <img
                    src={foto4Url}
                    alt="Foto 4 CRLV"
                    className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                    <ZoomIn className="w-5 h-5" />
                    <span>Ampliar</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>Não cadastrada</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400 block truncate">{foto4FileName}</span>
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {activeZoomPhoto && (
        <div
          onClick={() => setActiveZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm p-4 flex items-center justify-center cursor-zoom-out"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="font-bold text-sm">{activeZoomPhoto.title}</span>
              <button
                onClick={() => setActiveZoomPhoto(null)}
                className="p-2 text-white hover:text-slate-300 transition"
                title="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <img
              src={activeZoomPhoto.url}
              alt="Foto Ampliada"
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Confirmar Exclusão de Registro?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Tem certeza que deseja excluir o registro do veículo com placa <span className="font-mono font-bold text-slate-900">{registro.placa}</span> (ID #{registro.id})? Esta alteração será refletida no arquivo <span className="font-mono">Registros.csv</span>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de envio e anexo via WhatsApp */}
      <WhatsAppPromptModal
        isOpen={showWhatsAppPrompt}
        onClose={() => setShowWhatsAppPrompt(false)}
        registro={registro}
        reportText={whatsAppReportText}
        pdfBlob={whatsAppPdfBlob}
        pdfFileName={whatsAppPdfFileName}
      />
    </div>
  );
}

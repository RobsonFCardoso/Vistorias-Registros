import { useState, useMemo } from 'react';
import { Registro, RegistroStatus } from '../types';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { FolderExplorerModal } from './FolderExplorerModal';
import { CadastroBlitzModal } from './CadastroBlitzModal';
import { WhatsAppPromptModal } from './WhatsAppPromptModal';
import { sendRegistroToWhatsApp } from '../services/whatsappService';
import { Plus, CheckCircle2, XCircle, Search, FileSpreadsheet, Calendar, Clock, RefreshCw, Car, FolderOpen, AlertCircle, Shield, MessageCircle } from 'lucide-react';
import { getExportCsvContent, isNativeMobile } from '../services/androidStorage';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { resolvePhotoSrc } from '../utils/photoUrl';

interface DashboardViewProps {
  registros: Registro[];
  loading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  onSelectRegistro: (id: string) => void;
}

export function DashboardView({
  registros,
  loading,
  onRefresh,
  onCreateNew,
  onSelectRegistro
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RegistroStatus>('ALL');
  const [showFolderExplorer, setShowFolderExplorer] = useState(false);
  const [showBlitzModal, setShowBlitzModal] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // WhatsApp sharing states
  const [selectedWhatsAppRegistro, setSelectedWhatsAppRegistro] = useState<Registro | null>(null);
  const [whatsAppReportText, setWhatsAppReportText] = useState('');
  const [whatsAppPdfBlob, setWhatsAppPdfBlob] = useState<Blob | undefined>(undefined);
  const [whatsAppPdfFileName, setWhatsAppPdfFileName] = useState<string | undefined>(undefined);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [whatsAppToast, setWhatsAppToast] = useState<string | null>(null);

  const handleWhatsAppShare = async (reg: Registro) => {
    try {
      setSelectedWhatsAppRegistro(reg);
      const res = await sendRegistroToWhatsApp(reg);

      if (!res.success && res.error) {
        alert(res.error);
        return;
      }

      setWhatsAppReportText(res.messageText);
      if (res.pdfBlob) setWhatsAppPdfBlob(res.pdfBlob);
      if (res.pdfFileName) setWhatsAppPdfFileName(res.pdfFileName);

      if (res.needsPrompt) {
        setShowWhatsAppPrompt(true);
      } else {
        setWhatsAppToast(`Vistoria do veículo ${reg.placa} compartilhada com as 4 fotos via WhatsApp!`);
        setTimeout(() => setWhatsAppToast(null), 4000);
      }
    } catch (e: any) {
      alert('Erro ao compartilhar no WhatsApp: ' + (e.message || e));
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const csvContent = await getExportCsvContent();

      // No Android nativo, garante que é salvo em Download/Registros.csv
      if (isNativeMobile()) {
        try {
          await Filesystem.writeFile({
            path: 'Download/Registros.csv',
            data: csvContent,
            directory: Directory.ExternalStorage,
            encoding: Encoding.UTF8,
            recursive: true
          });
        } catch (fsErr) {
          console.warn('Erro ao salvar no ExternalStorage Download/Registros.csv:', fsErr);
        }
      }

      // Dispara download via Blob no navegador / WebView
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Registros.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erro ao exportar CSV: ' + err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  // Filter records
  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      const matchesSearch =
        r.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.includes(searchTerm) ||
        r.dia.includes(searchTerm) ||
        (r.nomeBlitz && r.nomeBlitz.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [registros, searchTerm, statusFilter]);

  const emAndamento = useMemo(() => {
    return filteredRegistros.filter(r => r.status === 'Teste Em Andamento');
  }, [filteredRegistros]);

  const aprovados = useMemo(() => {
    return filteredRegistros.filter(r => r.status === 'APROVADO');
  }, [filteredRegistros]);

  const reprovados = useMemo(() => {
    return filteredRegistros.filter(r => r.status === 'REPROVADO');
  }, [filteredRegistros]);

  const totalEmAndamentoCount = useMemo(() => registros.filter(r => r.status === 'Teste Em Andamento').length, [registros]);
  const totalAprovadosCount = useMemo(() => registros.filter(r => r.status === 'APROVADO').length, [registros]);
  const totalReprovadosCount = useMemo(() => registros.filter(r => r.status === 'REPROVADO').length, [registros]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase">
            <Car className="w-4 h-4" />
            <span>Controle de Vistorias Veiculares</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Painel de Registros
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs sm:text-sm text-slate-500">
              Armazenamento em <span className="font-mono font-medium text-slate-700">Registros.csv</span> e fotos em <span className="font-mono font-medium text-slate-700">RegistroFotos/</span>
            </p>
            <button
              id="btn-acessar-pasta-fotos"
              onClick={() => setShowFolderExplorer(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 text-xs font-bold border border-indigo-200/80 transition cursor-pointer shadow-2xs"
              title="Acessar a pasta onde estão sendo salvas as fotos"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Acessar Pasta de Fotos</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            id="btn-cadastrar-blitz-dashboard"
            onClick={() => setShowBlitzModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer"
            title="Cadastrar ou gerenciar registros de Blitz (ID, Nome, Endereço, Dia e Horário)"
          >
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Cadastrar Blitz</span>
          </button>

          <button
            onClick={() => setShowFolderExplorer(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-700 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer"
            title="Abrir explorador de fotos e salvar no aparelho"
          >
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>Pasta de Fotos</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Exportar arquivo Registros.csv para o aparelho"
          >
            {exportingCsv ? (
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            )}
            <span>{exportingCsv ? 'Exportando...' : 'Baixar CSV'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-criar-novo-registro"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold tracking-tight shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Criar novo Registro</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards: 4 Categorias (Total, Em Andamento, Aprovados, Reprovados) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'ALL'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Geral</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 block">{registros.length}</span>
        </div>

        <div
          onClick={() => setStatusFilter('Teste Em Andamento')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'Teste Em Andamento'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-800 uppercase tracking-wider truncate">Em Andamento</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-amber-800 mt-1 block">{totalEmAndamentoCount}</span>
        </div>

        <div
          onClick={() => setStatusFilter('APROVADO')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'APROVADO'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider">Aprovados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1 block">{totalAprovadosCount}</span>
        </div>

        <div
          onClick={() => setStatusFilter('REPROVADO')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'REPROVADO'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-700 uppercase tracking-wider">Reprovados</span>
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-800 mt-1 block">{totalReprovadosCount}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por placa, ID ou blitz..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Segmented Filter Control */}
        <div className="flex flex-wrap items-center p-1 bg-slate-200/80 rounded-xl self-start sm:self-auto text-xs font-semibold text-slate-600 gap-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Todos ({registros.length})
          </button>
          <button
            onClick={() => setStatusFilter('Teste Em Andamento')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              statusFilter === 'Teste Em Andamento' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'hover:text-amber-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Em Andamento ({totalEmAndamentoCount})
          </button>
          <button
            onClick={() => setStatusFilter('APROVADO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              statusFilter === 'APROVADO' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Aprovados ({totalAprovadosCount})
          </button>
          <button
            onClick={() => setStatusFilter('REPROVADO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              statusFilter === 'REPROVADO' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'hover:text-rose-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Reprovados ({totalReprovadosCount})
          </button>
        </div>
      </div>

      {/* Main Records Sections */}
      {filteredRegistros.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 space-y-3">
          <Car className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Nenhum registro encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Tente ajustar os filtros ou termo de busca acima.'
              : 'O sistema está limpo e pronto para o primeiro cadastro de vistoria veicular.'}
          </p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Primeira Vistoria</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seção Em Andamento */}
          {(statusFilter === 'ALL' || statusFilter === 'Teste Em Andamento') && emAndamento.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-700 text-white px-4 py-2.5 rounded-xl shadow-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-200" />
                  <h2 className="font-bold text-xs sm:text-sm tracking-wide uppercase">
                    Testes Em Andamento
                  </h2>
                </div>
                <span className="bg-amber-800/80 text-amber-100 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-600">
                  {emAndamento.length} {emAndamento.length === 1 ? 'veículo' : 'veículos'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {emAndamento.map((item) => (
                  <RegistroCard key={item.id} registro={item} onSelect={() => onSelectRegistro(item.id)} onWhatsApp={handleWhatsAppShare} />
                ))}
              </div>
            </div>
          )}

          {/* Seção Aprovados */}
          {(statusFilter === 'ALL' || statusFilter === 'APROVADO') && aprovados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <h2 className="font-bold text-xs sm:text-sm tracking-wide uppercase">
                    Veículos Aprovados
                  </h2>
                </div>
                <span className="bg-emerald-800/80 text-emerald-100 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-600">
                  {aprovados.length} {aprovados.length === 1 ? 'veículo' : 'veículos'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aprovados.map((item) => (
                  <RegistroCard key={item.id} registro={item} onSelect={() => onSelectRegistro(item.id)} onWhatsApp={handleWhatsAppShare} />
                ))}
              </div>
            </div>
          )}

          {/* Seção Reprovados */}
          {(statusFilter === 'ALL' || statusFilter === 'REPROVADO') && reprovados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-rose-700 text-white px-4 py-2.5 rounded-xl shadow-xs">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-200" />
                  <h2 className="font-bold text-xs sm:text-sm tracking-wide uppercase">
                    Veículos Reprovados
                  </h2>
                </div>
                <span className="bg-rose-800/80 text-rose-100 text-xs font-bold px-2 py-0.5 rounded-full border border-rose-600">
                  {reprovados.length} {reprovados.length === 1 ? 'veículo' : 'veículos'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reprovados.map((item) => (
                  <RegistroCard key={item.id} registro={item} onSelect={() => onSelectRegistro(item.id)} onWhatsApp={handleWhatsAppShare} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification de WhatsApp */}
      {whatsAppToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 text-xs sm:text-sm font-semibold border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{whatsAppToast}</span>
        </div>
      )}

      {/* Modal: Explorador da Pasta de Fotos */}
      <FolderExplorerModal
        isOpen={showFolderExplorer}
        onClose={() => setShowFolderExplorer(false)}
        registros={registros}
      />

      {/* Modal: Cadastramento e Gerenciamento de Blitz */}
      <CadastroBlitzModal
        isOpen={showBlitzModal}
        onClose={() => setShowBlitzModal(false)}
      />

      {/* Modal: Envio via WhatsApp com Fotos */}
      <WhatsAppPromptModal
        isOpen={showWhatsAppPrompt}
        onClose={() => setShowWhatsAppPrompt(false)}
        registro={selectedWhatsAppRegistro}
        reportText={whatsAppReportText}
        pdfBlob={whatsAppPdfBlob}
        pdfFileName={whatsAppPdfFileName}
      />
    </div>
  );
}

interface RegistroCardProps {
  key?: string;
  registro: Registro;
  onSelect: () => void;
  onWhatsApp: (reg: Registro) => void;
}

function RegistroCard({ registro, onSelect, onWhatsApp }: RegistroCardProps) {
  const isAprovado = registro.status === 'APROVADO';
  const isReprovado = registro.status === 'REPROVADO';

  return (
    <div
      onClick={onSelect}
      className={`group bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99] flex items-center justify-between gap-3 ${
        isAprovado
          ? 'border-emerald-100 hover:border-emerald-400 hover:bg-emerald-50/20'
          : isReprovado
          ? 'border-rose-100 hover:border-rose-400 hover:bg-rose-50/20'
          : 'border-amber-100 hover:border-amber-400 hover:bg-amber-50/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <VehiclePlateBadge placa={registro.placa} size="md" />

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              #{registro.id}
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isAprovado
                  ? 'bg-emerald-100 text-emerald-800'
                  : isReprovado
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {registro.status}
            </span>
            {registro.nomeBlitz && (
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full truncate max-w-[120px] sm:max-w-[180px]" title={registro.nomeBlitz}>
                {registro.nomeBlitz}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {registro.dia}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {registro.hora}
            </span>
          </div>
        </div>
      </div>

      {/* Mini Thumbnails and WhatsApp Action */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
            <img
              src={resolvePhotoSrc(registro.foto1)}
              alt="Foto 1"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23e2e8f0"/><text x="20" y="24" font-size="9" text-anchor="middle" fill="%2394a3b8">F1</text></svg>';
              }}
            />
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
            <img
              src={resolvePhotoSrc(registro.foto2)}
              alt="Foto 2"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23e2e8f0"/><text x="20" y="24" font-size="9" text-anchor="middle" fill="%2394a3b8">F2</text></svg>';
              }}
            />
          </div>
        </div>

        {/* Botão Enviar via WhatsApp */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onWhatsApp(registro);
          }}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition flex items-center gap-1.5 font-bold text-xs shadow-2xs active:scale-95 cursor-pointer ml-1"
          title="Enviar relatório e fotos via WhatsApp"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
      </div>
    </div>
  );
}

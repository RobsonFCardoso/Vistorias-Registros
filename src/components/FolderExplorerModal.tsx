import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Folder, 
  FolderOpen, 
  Download, 
  Smartphone, 
  Search, 
  X, 
  RefreshCw, 
  FileImage, 
  ExternalLink, 
  Check, 
  Copy, 
  HardDrive,
  AlertCircle
} from 'lucide-react';
import { StorageFolder, StorageFile, Registro } from '../types';
import { syncAllFoldersToMobileDownload, isNativeMobile } from '../utils/mobileStorage';
import { listLocalFoldersAndFiles, getExportCsvContent } from '../services/androidStorage';
import { resolvePhotoSrc } from '../utils/photoUrl';

interface FolderExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  registros: Registro[];
}

export function FolderExplorerModal({ isOpen, onClose, registros }: FolderExplorerModalProps) {
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingMobile, setSyncingMobile] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedFolder, setCopiedFolder] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<StorageFile | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      setError(null);

      // 100% Offline: Carrega diretamente a partir dos registros locais
      const localFolders = await listLocalFoldersAndFiles();
      setFolders(localFolders);
    } catch (err: any) {
      console.warn('Erro ao carregar pastas:', err);
      setError(err.message || 'Erro ao carregar pastas de fotos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      const zip = new JSZip();

      // Adiciona o arquivo Registros.csv na raiz do ZIP
      const csvContent = await getExportCsvContent();
      zip.file('Registros.csv', csvContent);

      // Adiciona as pastas de fotos
      for (const folder of folders) {
        const folderZip = zip.folder(folder.folderName);
        for (const file of folder.files) {
          let base64 = '';
          if (file.url.startsWith('data:')) {
            base64 = file.url.includes(',') ? file.url.split(',')[1] : file.url;
            folderZip?.file(file.fileName, base64, { base64: true });
          } else {
            try {
              const res = await fetch(file.url);
              const blob = await res.blob();
              folderZip?.file(file.fileName, blob);
            } catch {
              // Se falhar ao buscar url externa, continua
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'RegistroFotos_Download.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert('Erro ao gerar arquivo ZIP: ' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalFiles = folders.reduce((acc, f) => acc + f.files.length, 0);
  const totalBytes = folders.reduce(
    (acc, f) => acc + f.files.reduce((fAcc, file) => fAcc + file.size, 0),
    0
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredFolders = folders.filter((f) => {
    const term = searchTerm.toLowerCase();
    return (
      f.folderName.toLowerCase().includes(term) ||
      f.files.some((file) => file.fileName.toLowerCase().includes(term))
    );
  });

  const handleCopyPath = (pathText: string, folderName: string) => {
    navigator.clipboard.writeText(pathText);
    setCopiedFolder(folderName);
    setTimeout(() => setCopiedFolder(null), 2000);
  };

  const handleSyncToMobile = async () => {
    try {
      setSyncingMobile(true);
      setSyncStatus('Iniciando sincronização...');
      const result = await syncAllFoldersToMobileDownload(registros, (_cur, _tot, msg) => {
        setSyncStatus(msg);
      });
      setSyncStatus(result.message);
      setTimeout(() => {
        setSyncStatus(null);
      }, 6000);
    } catch (err: any) {
      setSyncStatus('Erro: ' + err.message);
    } finally {
      setSyncingMobile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-600/20">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Pasta RegistroFotos/
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                  {folders.length} {folders.length === 1 ? 'subpasta' : 'subpastas'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Armazenamento das fotos por vistoria • Local no celular:{' '}
                <span className="font-mono font-semibold text-slate-800 bg-slate-200/70 px-1.5 py-0.5 rounded">
                  Download/RegistroFotos/
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Banner if active */}
        {syncStatus && (
          <div className="bg-indigo-50 border-b border-indigo-200/80 px-6 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-indigo-900 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 font-medium">
              <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{syncStatus}</span>
            </div>
            {syncingMobile && (
              <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin shrink-0" />
            )}
          </div>
        )}

        {/* Action Bar & Quick Stats */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por placa ou subpasta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sincronizar na Pasta Download do Celular */}
            <button
              onClick={handleSyncToMobile}
              disabled={syncingMobile}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              title="Cria a pasta RegistroFotos e suas subpastas dentro da pasta Download do celular"
            >
              {syncingMobile ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              <span>Salvar na Pasta Download do Celular</span>
            </button>

            {/* Baixar ZIP Completo */}
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-98 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Baixar arquivo ZIP com todas as subpastas e fotos"
            >
              {downloadingZip ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-blue-600" />
              )}
              <span>{downloadingZip ? 'Gerando ZIP...' : 'Baixar ZIP Completo'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchFolders}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              title="Recarregar pastas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Directory Explorer Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          {/* Breadcrumb info indicator */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Caminho do dispositivo:</span>
              <span className="font-bold text-slate-800">
                📁 Download/RegistroFotos/
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>{totalFiles} fotos</span>
              <span>•</span>
              <span>{formatBytes(totalBytes)}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-500">
                Lendo diretório de fotos no servidor e dispositivo...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <h3 className="font-bold text-rose-800">Erro ao carregar arquivos</h3>
              <p className="text-xs text-rose-600">{error}</p>
              <button
                onClick={fetchFolders}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-8">
              <Folder className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700">Nenhuma subpasta encontrada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchTerm
                  ? `Nenhum resultado para "${searchTerm}". Tente buscar por outro termo.`
                  : 'Nenhum registro com fotos foi criado ainda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFolders.map((folder) => {
                const fullPhonePath = `Download/RegistroFotos/${folder.folderName}/`;
                const isCopied = copiedFolder === folder.folderName;

                return (
                  <div
                    key={folder.folderName}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition hover:border-indigo-200"
                  >
                    {/* Subfolder Header */}
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-5 h-5 text-amber-500 fill-amber-100" />
                        <div>
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {folder.folderName}/
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            ({folder.files.length} {folder.files.length === 1 ? 'foto' : 'fotos'})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Copy Full Path Button */}
                        <button
                          onClick={() => handleCopyPath(fullPhonePath, folder.folderName)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
                          title="Copiar caminho completo da pasta no celular"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copiar Caminho</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Files inside this subfolder */}
                    <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {folder.files.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Pasta vazia.
                        </p>
                      ) : (
                        folder.files.map((file) => {
                          const fileSrc = resolvePhotoSrc(file.url || file.filePath);
                          return (
                            <div
                              key={file.fileName}
                              className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition"
                            >
                              {/* Photo Thumbnail */}
                              <div 
                                className="w-14 h-14 rounded-lg bg-slate-200 overflow-hidden shrink-0 cursor-pointer border border-slate-300/60 relative group"
                                onClick={() => setPreviewPhoto(file)}
                                title="Clique para ampliar"
                              >
                                <img
                                  src={fileSrc}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>

                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-xs font-bold text-slate-800 truncate" title={file.fileName}>
                                  {file.fileName}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                  <span>{formatBytes(file.size)}</span>
                                  <span>•</span>
                                  <span className="font-mono truncate">
                                    {file.fileName.includes('foto1') 
                                      ? 'Foto 1 (Frente)' 
                                      : file.fileName.includes('foto2') 
                                      ? 'Foto 2 (Traseira)' 
                                      : file.fileName.includes('foto3') 
                                      ? 'Foto 3 (CNH)' 
                                      : file.fileName.includes('foto4') 
                                      ? 'Foto 4 (CRLV)' 
                                      : 'Foto'}
                                  </span>
                                </div>
                              </div>

                              {/* Download file button */}
                              <div className="flex items-center gap-1">
                                <a
                                  href={fileSrc}
                                  download={file.fileName}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title={`Baixar ${file.fileName}`}
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Help Notice */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              {isNativeMobile()
                ? 'Aplicativo Android: As pastas são criadas na pasta Download do armazenamento interno.'
                : 'No celular ou PC: Você pode salvar ou baixar o ZIP e extraí-lo na pasta Download.'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer"
          >
            Fechar Explorador
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            className="max-w-3xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-950/80 flex items-center justify-between gap-3 text-white border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-xs font-bold">{previewPhoto.fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={resolvePhotoSrc(previewPhoto.url || previewPhoto.filePath)}
                  download={previewPhoto.fileName}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title="Baixar foto"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/40 overflow-auto">
              <img
                src={resolvePhotoSrc(previewPhoto.url || previewPhoto.filePath)}
                alt={previewPhoto.fileName}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

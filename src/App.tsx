import { useState, useEffect, useCallback } from 'react';
import { Registro, RegistroFormData, ActiveView } from './types';
import { 
  STORAGE_KEY, 
  getLocalRegistros, 
  writeRegistrosCsvToDevice, 
  createRegistro, 
  updateRegistro, 
  deleteRegistro 
} from './services/api';
import { DashboardView } from './components/DashboardView';
import { RegistroFormView } from './components/RegistroFormView';
import { RegistroDetailView } from './components/RegistroDetailView';
import { requestAndroidPermissions, isNativeMobile } from './services/androidStorage';
import { Car, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'dashboard' });
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active record state for Edit and View screens
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);

  // Auto request Android permissions on app launch
  useEffect(() => {
    if (isNativeMobile()) {
      requestAndroidPermissions().catch(err => {
        console.warn('Permissões Android:', err);
      });
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  /**
   * Inicialização 100% Offline: Carrega dados do LocalStorage ('registros_vistorias')
   * e converte diretamente para o estado principal da aplicação (setRegistros),
   * garantindo que a lista e as contagens nunca resetem ao fechar o app.
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = getLocalRegistros();
      setRegistros(data);

      // Sincroniza o arquivo Registros.csv no celular em background
      writeRegistrosCsvToDevice(data).catch(err => {
        console.warn('Sincronização em background do CSV:', err);
      });
    } catch (err: any) {
      console.error('Erro ao carregar registros do localStorage:', err);
      setError(err.message || 'Falha ao carregar registros locais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate to View screen for a specific record
  const handleSelectRegistro = (id: string) => {
    const found = registros.find(r => r.id === id);
    if (found) {
      setSelectedRegistro(found);
      setActiveView({ type: 'view', id });
    } else {
      alert(`Registro #${id} não encontrado.`);
    }
  };

  // Navigate to Edit screen
  const handleEditRegistro = (id: string) => {
    const reg = registros.find(r => r.id === id) || selectedRegistro;
    if (reg) {
      setSelectedRegistro(reg);
      setActiveView({ type: 'edit', id });
    }
  };

  // Handle Save (Create or Edit) 100% Local com persistência no LocalStorage e atualização instantânea da UI
  const handleSaveForm = async (formData: RegistroFormData) => {
    try {
      setLoading(true);
      if (activeView.type === 'edit') {
        const { registro: updated, saveResult } = await updateRegistro(activeView.id, formData);

        // Atualização reativa imediata no estado do React
        const updatedList = registros.map(r => r.id === updated.id ? updated : r);
        setRegistros(updatedList);
        setSelectedRegistro(updated);

        if (saveResult.failedCount > 0) {
          showToast(`Registro #${updated.id} atualizado com avisos: ${saveResult.failedMessages.join('; ')}`);
        } else {
          showToast(`Registro da placa ${updated.placa} atualizado e fotos validadas com sucesso!`);
        }
        setActiveView({ type: 'view', id: updated.id });
      } else {
        const { registro: created, saveResult } = await createRegistro(formData);

        // Atualização reativa imediata no estado do React (adiciona no topo)
        const updatedList = [created, ...registros.filter(r => r.id !== created.id)];
        setRegistros(updatedList);
        setSelectedRegistro(created);

        if (saveResult.failedCount > 0) {
          showToast(`Registro criado com avisos: ${saveResult.failedMessages.join('; ')}`);
        } else {
          showToast(`Novo registro criado com as 4 fotos salvas para a placa ${created.placa}!`);
        }
        setActiveView({ type: 'view', id: created.id });
      }
    } catch (err: any) {
      alert('Erro ao salvar registro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete 100% Local com atualização imediata no React e no CSV
  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await deleteRegistro(id);
      
      const updatedList = registros.filter(r => r.id !== id);
      setRegistros(updatedList);
      setSelectedRegistro(null);

      showToast(`Registro #${id} excluído com sucesso do CSV.`);
      setActiveView({ type: 'dashboard' });
    } catch (err: any) {
      alert('Erro ao excluir registro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Global Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => setActiveView({ type: 'dashboard' })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 group-hover:scale-105 transition">
              <Car className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                  Vistorias & Registros
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Inspeção Veicular • Registros.csv
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {activeView.type !== 'create' && (
              <button
                onClick={() => {
                  setSelectedRegistro(null);
                  setActiveView({ type: 'create' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <span>+ Novo Registro</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 border border-slate-800 text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {activeView.type === 'dashboard' && (
          <DashboardView
            registros={registros}
            loading={loading}
            onRefresh={loadData}
            onCreateNew={() => {
              setSelectedRegistro(null);
              setActiveView({ type: 'create' });
            }}
            onSelectRegistro={handleSelectRegistro}
          />
        )}

        {/* Create or Edit View */}
        {(activeView.type === 'create' || activeView.type === 'edit') && (
          <RegistroFormView
            initialData={activeView.type === 'edit' ? selectedRegistro : null}
            onSave={handleSaveForm}
            onCancel={() => {
              if (activeView.type === 'edit' && selectedRegistro) {
                setActiveView({ type: 'view', id: selectedRegistro.id });
              } else {
                setActiveView({ type: 'dashboard' });
              }
            }}
          />
        )}

        {/* View / Detail Screen */}
        {activeView.type === 'view' && selectedRegistro && (
          <RegistroDetailView
            registro={selectedRegistro}
            onBack={() => setActiveView({ type: 'dashboard' })}
            onEdit={() => handleEditRegistro(selectedRegistro.id)}
            onDelete={() => handleDelete(selectedRegistro.id)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/60 py-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistema de Vistorias e Registros Veiculares</span>
          <span className="font-mono text-slate-400 text-[11px]">
            Registros.csv (delimitador ;) • RegistroFotos/(ID_PLACA)
          </span>
        </div>
      </footer>
    </div>
  );
}

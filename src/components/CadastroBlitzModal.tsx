import React, { useState, useEffect } from 'react';
import { BlitzOption } from '../types';
import { getLocalBlitzList, saveLocalBlitz, deleteLocalBlitz } from '../services/blitzStorage';
import { X, Plus, Shield, MapPin, Calendar, Clock, Hash, Check, Trash2, ShieldCheck } from 'lucide-react';

interface CadastroBlitzModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlitz?: (blitz: BlitzOption) => void;
}

export function CadastroBlitzModal({ isOpen, onClose, onSelectBlitz }: CadastroBlitzModalProps) {
  const [blitzList, setBlitzList] = useState<BlitzOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(true);

  // Form fields
  const [id, setId] = useState('');
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dia, setDia] = useState(new Date().toISOString().split('T')[0]);
  const [horario, setHorario] = useState('08:00 - 14:00');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBlitzes();
    }
  }, [isOpen]);

  const loadBlitzes = () => {
    const list = getLocalBlitzList();
    setBlitzList(list);

    // Sugere próximo ID
    let maxId = 0;
    for (const b of list) {
      const num = parseInt(b.id, 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
    setId(String(maxId + 1));
  };

  const resetForm = () => {
    let maxId = 0;
    for (const b of blitzList) {
      const num = parseInt(b.id, 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
    setId(String(maxId + 1));
    setNome('');
    setEndereco('');
    setDia(new Date().toISOString().split('T')[0]);
    setHorario('08:00 - 14:00');
    setError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = id.trim();
    const cleanNome = nome.trim();
    const cleanEndereco = endereco.trim();
    const cleanDia = dia.trim();
    const cleanHorario = horario.trim();

    if (!cleanId) {
      setError('O ID da blitz é obrigatório.');
      return;
    }
    if (!cleanNome) {
      setError('O Nome da blitz é obrigatório.');
      return;
    }
    if (!cleanEndereco) {
      setError('O Endereço da blitz é obrigatório.');
      return;
    }
    if (!cleanDia) {
      setError('A Data (dia) é obrigatória.');
      return;
    }
    if (!cleanHorario) {
      setError('O Horário é obrigatório.');
      return;
    }

    const newBlitz: BlitzOption = {
      id: cleanId,
      nome: cleanNome,
      endereco: cleanEndereco,
      dia: cleanDia,
      horario: cleanHorario,
    };

    const updated = saveLocalBlitz(newBlitz);
    setBlitzList(updated);
    setSuccessMsg(`Blitz "${cleanNome}" cadastrada com sucesso!`);
    setTimeout(() => setSuccessMsg(null), 3500);

    if (onSelectBlitz) {
      onSelectBlitz(newBlitz);
    }

    resetForm();
  };

  const handleDelete = (blitzId: string, blitzNome: string) => {
    if (window.confirm(`Deseja remover a blitz "${blitzNome}" (ID #${blitzId})?`)) {
      const updated = deleteLocalBlitz(blitzId);
      setBlitzList(updated);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Cadastro de Blitz
              </h2>
              <p className="text-xs text-slate-500">
                Cadastre e gerencie as operações e pontos de vistoria
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
        <div className="p-5 overflow-y-auto space-y-6">
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold">
              {error}
            </div>
          )}

          {/* Form to add a new Blitz */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Novo Registro de Blitz</span>
              </h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ID */}
                <div className="space-y-1">
                  <label htmlFor="blitz-id" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    ID *
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="blitz-id"
                      type="text"
                      required
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="Ex: 1"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Nome */}
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="blitz-nome" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Nome da Blitz *
                  </label>
                  <div className="relative">
                    <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="blitz-nome"
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Operação Lei Seca - Av. Principal"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Endereco */}
              <div className="space-y-1">
                <label htmlFor="blitz-endereco" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Endereço *
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="blitz-endereco"
                    type="text"
                    required
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Ex: Av. Brasil, Ponto 01"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dia */}
                <div className="space-y-1">
                  <label htmlFor="blitz-dia" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Data (Dia) *
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="blitz-dia"
                      type="date"
                      required
                      value={dia}
                      onChange={(e) => setDia(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Horario */}
                <div className="space-y-1">
                  <label htmlFor="blitz-horario" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Horário *
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="blitz-horario"
                      type="text"
                      required
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                      placeholder="Ex: 08:00 - 14:00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Cadastrar Blitz</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of registered Blitzes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Blitz Cadastradas ({blitzList.length})
            </h3>

            {blitzList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhuma blitz cadastrada no momento.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {blitzList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                          #{item.id}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {item.nome}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.endereco}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {item.dia}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.horario}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {onSelectBlitz && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBlitz(item);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Selecionar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.nome)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Remover Blitz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
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
  );
}

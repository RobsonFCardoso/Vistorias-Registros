import React, { useState } from 'react';
import { Registro, RegistroFormData, RegistroStatus, BlitzOption } from '../types';
import { CameraCaptureModal } from './CameraCaptureModal';
import { CadastroBlitzModal } from './CadastroBlitzModal';
import { VehiclePlateBadge } from './VehiclePlateBadge';
import { getLocalBlitzList } from '../services/blitzStorage';
import { ArrowLeft, Camera, Check, Clock, Calendar, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Shield, FileText, Plus, MapPin } from 'lucide-react';
import { resolvePhotoSrc } from '../utils/photoUrl';

interface RegistroFormViewProps {
  initialData?: Registro | null;
  onSave: (data: RegistroFormData) => Promise<void>;
  onCancel: () => void;
}

export function RegistroFormView({ initialData, onSave, onCancel }: RegistroFormViewProps) {
  const isEditing = !!initialData;

  // Helpers for current date & time
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [blitzOptions, setBlitzOptions] = useState<BlitzOption[]>(() => getLocalBlitzList());
  const [showBlitzModal, setShowBlitzModal] = useState(false);

  const [nomeBlitz, setNomeBlitz] = useState(
    initialData?.nomeBlitz || (blitzOptions[0]?.nome || '')
  );
  const [dia, setDia] = useState(initialData?.dia || getTodayDate());
  const [hora, setHora] = useState(initialData?.hora || getCurrentTime());
  const [placa, setPlaca] = useState(initialData?.placa || '');
  const [status, setStatus] = useState<RegistroStatus>(initialData?.status || 'Teste Em Andamento');

  // Photo states (Foto 1: Frente, Foto 2: Atrás, Foto 3: CNH, Foto 4: CRLV)
  const [foto1Base64, setFoto1Base64] = useState<string | undefined>(undefined);
  const [foto2Base64, setFoto2Base64] = useState<string | undefined>(undefined);
  const [foto3Base64, setFoto3Base64] = useState<string | undefined>(undefined);
  const [foto4Base64, setFoto4Base64] = useState<string | undefined>(undefined);

  const [foto1Preview, setFoto1Preview] = useState<string | undefined>(initialData?.foto1);
  const [foto2Preview, setFoto2Preview] = useState<string | undefined>(initialData?.foto2);
  const [foto3Preview, setFoto3Preview] = useState<string | undefined>(initialData?.foto3);
  const [foto4Preview, setFoto4Preview] = useState<string | undefined>(initialData?.foto4);

  // Active camera modal state
  const [cameraTarget, setCameraTarget] = useState<1 | 2 | 3 | 4 | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto uppercase plate
  const handlePlacaChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
    setPlaca(cleaned);
  };

  const handlePhotoCaptured = (base64: string) => {
    if (cameraTarget === 1) {
      setFoto1Base64(base64);
      setFoto1Preview(base64);
    } else if (cameraTarget === 2) {
      setFoto2Base64(base64);
      setFoto2Preview(base64);
    } else if (cameraTarget === 3) {
      setFoto3Base64(base64);
      setFoto3Preview(base64);
    } else if (cameraTarget === 4) {
      setFoto4Base64(base64);
      setFoto4Preview(base64);
    }
    setCameraTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanPlaca || cleanPlaca.length < 5) {
      setErrorMessage('Por favor, informe uma placa válida (mínimo 5 caracteres alfanuméricos).');
      return;
    }

    if (!dia || !hora) {
      setErrorMessage('Data e hora são obrigatórias.');
      return;
    }

    try {
      setSubmitting(true);
      await onSave({
        nomeBlitz: nomeBlitz.trim(),
        dia,
        hora,
        placa: cleanPlaca,
        status,
        foto1Base64,
        foto2Base64,
        foto3Base64,
        foto4Base64,
        foto1Existing: initialData?.foto1,
        foto2Existing: initialData?.foto2,
        foto3Existing: initialData?.foto3,
        foto4Existing: initialData?.foto4,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao salvar o registro.');
      setSubmitting(false);
    }
  };

  const getCameraModalTitle = () => {
    switch (cameraTarget) {
      case 1:
        return 'Capturar Foto 1 (Frente / Principal)';
      case 2:
        return 'Capturar Foto 2 (Atrás / Detalhe)';
      case 3:
        return 'Capturar Foto 3 (Documento CNH)';
      case 4:
        return 'Capturar Foto 4 (Documento CRLV)';
      default:
        return 'Capturar Foto';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
          {isEditing ? `Editando ID #${initialData?.id}` : 'Novo Cadastro'}
        </span>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isEditing ? 'Editar Registro de Vistoria' : 'Criar Novo Registro'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Preencha os dados da vistoria, selecione a blitz e capture as fotos necessárias (Frente, Atrás, CNH e CRLV).
          </p>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção ao preencher:</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Selection: 3 Options (Teste Em Andamento / APROVADO / REPROVADO) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Resultado da Vistoria (STATUS) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('Teste Em Andamento')}
                className={`py-3 px-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition cursor-pointer ${
                  status === 'Teste Em Andamento'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className={`w-4 h-4 ${status === 'Teste Em Andamento' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Teste Em Andamento</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('APROVADO')}
                className={`py-3 px-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition cursor-pointer ${
                  status === 'APROVADO'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${status === 'APROVADO' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>APROVADO</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('REPROVADO')}
                className={`py-3 px-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition cursor-pointer ${
                  status === 'REPROVADO'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className={`w-4 h-4 ${status === 'REPROVADO' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>REPROVADO</span>
              </button>
            </div>
          </div>

          {/* Requisito: SELEÇÃO E CADASTRAMENTO DE "NOME DA BLITZ" */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="nome-blitz-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Nome da Blitz *
              </label>

              {/* Botão para o cadastramento do registro de nome da blitz */}
              <button
                type="button"
                id="btn-cadastrar-blitz"
                onClick={() => setShowBlitzModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200 cursor-pointer shadow-2xs"
                title="Cadastrar nova Blitz com ID, Nome, Endereço, Dia e Horário"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Cadastrar Blitz</span>
              </button>
            </div>

            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="nome-blitz-select"
                required
                value={nomeBlitz}
                onChange={(e) => {
                  const val = e.target.value;
                  setNomeBlitz(val);
                  const selectedOpt = blitzOptions.find((b) => b.nome === val);
                  if (selectedOpt?.dia) {
                    setDia(selectedOpt.dia);
                  }
                }}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer"
              >
                <option value="">Selecione uma Blitz cadastrada...</option>
                {blitzOptions.map((opt) => (
                  <option key={opt.id} value={opt.nome}>
                    #{opt.id} - {opt.nome} — {opt.endereco} ({opt.horario})
                  </option>
                ))}
                {nomeBlitz && !blitzOptions.some((o) => o.nome === nomeBlitz) && (
                  <option value={nomeBlitz}>{nomeBlitz}</option>
                )}
              </select>
            </div>

            {/* Exibe detalhes da Blitz selecionada */}
            {(() => {
              const currentBlitz = blitzOptions.find((b) => b.nome === nomeBlitz);
              if (!currentBlitz) return null;
              return (
                <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono font-bold text-slate-800">ID #{currentBlitz.id}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{currentBlitz.endereco}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{currentBlitz.dia}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{currentBlitz.horario}</span>
                  </span>
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-400">
              Escolha uma blitz já cadastrada ou clique em <strong>"+ Cadastrar Blitz"</strong> para registrar um novo ponto de operação.
            </p>
          </div>

          {/* Vehicle License Plate (PLACA) */}
          <div className="space-y-2">
            <label htmlFor="placa-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Placa do Veículo *
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <input
                  id="placa-input"
                  type="text"
                  required
                  placeholder="Ex: ABC1D23 ou ABC1234"
                  value={placa}
                  onChange={(e) => handlePlacaChange(e.target.value)}
                  maxLength={8}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-mono font-bold tracking-wider text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              {/* Real-time Brazilian Plate Preview */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Visualização:</span>
                <VehiclePlateBadge placa={placa || 'PLACA'} size="md" />
              </div>
            </div>
          </div>

          {/* DIA and HORA fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="dia-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Data (DIA) *
                </label>
                <button
                  type="button"
                  onClick={() => setDia(getTodayDate())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Hoje
                </button>
              </div>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="dia-input"
                  type="date"
                  required
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="hora-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Hora *
                </label>
                <button
                  type="button"
                  onClick={() => setHora(getCurrentTime())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Agora
                </button>
              </div>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="hora-input"
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Requisito 6: SUPORTE PARA 4 FOTOS (Frente, Atrás, CNH e CRLV) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Captura de Fotos (Veículo e Documentos)
                </label>
                <p className="text-xs text-slate-500">
                  Fotos salvas na pasta do aparelho em <span className="font-mono text-slate-700">RegistroFotos/(ID_PLACA)/</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo 1: Frente */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Foto 1 (Frente)</span>
                    {foto1Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">_foto1.jpg</span>
                </span>

                <div
                  onClick={() => setCameraTarget(1)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all ${
                    foto1Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto1Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto1Preview)}
                        alt="Foto 1 Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Frente Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Foto 1 (Frente)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo 2: Atrás */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Foto 2 (Atrás)</span>
                    {foto2Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">_foto2.jpg</span>
                </span>

                <div
                  onClick={() => setCameraTarget(2)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all ${
                    foto2Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto2Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto2Preview)}
                        alt="Foto 2 Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        Atrás Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Foto 2 (Atrás)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo 3: CNH */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Foto 3 (CNH)</span>
                    {foto3Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">_foto3.jpg</span>
                </span>

                <div
                  onClick={() => setCameraTarget(3)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all ${
                    foto3Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto3Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto3Preview)}
                        alt="Foto 3 (CNH) Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        CNH Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Foto 3 (CNH)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo 4: CRLV */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>Foto 4 (CRLV)</span>
                    {foto4Preview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">_foto4.jpg</span>
                </span>

                <div
                  onClick={() => setCameraTarget(4)}
                  className={`group relative aspect-4/3 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all ${
                    foto4Preview
                      ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                  }`}
                >
                  {foto4Preview ? (
                    <>
                      <img
                        src={resolvePhotoSrc(foto4Preview)}
                        alt="Foto 4 (CRLV) Capturada"
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold">
                        <Camera className="w-5 h-5" />
                        <span>Tirar Nova Foto</span>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        CRLV Salva
                      </span>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center group-hover:scale-110 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Foto 4 (CRLV)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para capturar
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="py-3 px-5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando no CSV e Gravando Fotos...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Concluir e Salvar Registro'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      {cameraTarget !== null && (
        <CameraCaptureModal
          title={getCameraModalTitle()}
          onCapture={handlePhotoCaptured}
          onClose={() => setCameraTarget(null)}
        />
      )}

      {/* Modal de Cadastramento do Registro de Nome da Blitz */}
      <CadastroBlitzModal
        isOpen={showBlitzModal}
        onClose={() => setShowBlitzModal(false)}
        onSelectBlitz={(newBlitz) => {
          setBlitzOptions(getLocalBlitzList());
          setNomeBlitz(newBlitz.nome);
          if (newBlitz.dia) {
            setDia(newBlitz.dia);
          }
        }}
      />
    </div>
  );
}

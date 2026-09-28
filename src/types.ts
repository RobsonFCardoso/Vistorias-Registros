export type RegistroStatus = 'Teste Em Andamento' | 'APROVADO' | 'REPROVADO';

export interface BlitzOption {
  id: string;
  nome: string;
  endereco: string;
  dia: string;
  horario: string;
}

export const DEFAULT_BLITZ_OPTIONS: BlitzOption[] = [
  {
    id: '1',
    nome: 'Operação Lei Seca - Av. Principal',
    endereco: 'Av. Brasil, Ponto 01',
    dia: '2026-09-25',
    horario: '08:00 - 14:00',
  },
  {
    id: '2',
    nome: 'Fiscalização Integrada de Trânsito',
    endereco: 'Rodovia Municipal km 12',
    dia: '2026-09-25',
    horario: '14:00 - 20:00',
  },
  {
    id: '3',
    nome: 'Operação Trânsito Seguro - Centro',
    endereco: 'Praça Central / Rua das Flores',
    dia: '2026-09-25',
    horario: '07:30 - 13:30',
  },
  {
    id: '4',
    nome: 'Blitz Noturna - Corredor Express',
    endereco: 'Av. das Américas, Posto Policial',
    dia: '2026-09-25',
    horario: '20:00 - 02:00',
  },
];

export interface Registro {
  id: string;
  nomeBlitz?: string;
  dia: string;
  hora: string;
  placa: string;
  foto1: string;
  foto2: string;
  foto3?: string;
  foto4?: string;
  status: RegistroStatus;
}

export interface RegistroFormData {
  nomeBlitz?: string;
  dia: string;
  hora: string;
  placa: string;
  status: RegistroStatus;
  foto1Base64?: string;
  foto2Base64?: string;
  foto3Base64?: string;
  foto4Base64?: string;
  foto1Existing?: string;
  foto2Existing?: string;
  foto3Existing?: string;
  foto4Existing?: string;
}

export type ActiveView = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'edit'; id: string }
  | { type: 'view'; id: string };

export interface StorageFile {
  fileName: string;
  filePath: string;
  url: string;
  size: number;
  modifiedAt: string;
}

export interface StorageFolder {
  folderName: string;
  folderPath: string;
  files: StorageFile[];
}

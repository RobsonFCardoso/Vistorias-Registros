import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const CSV_FILE = path.join(process.cwd(), 'Registros.csv');
const FOTOS_DIR = path.join(process.cwd(), 'RegistroFotos');
const CSV_HEADER = 'IDREGISTROS;NOME_BLITZ;DIA;HORA;PLACA;FOTO1;FOTO2;STATUS';

// Ensure photos root directory exists
if (!fs.existsSync(FOTOS_DIR)) {
  fs.mkdirSync(FOTOS_DIR, { recursive: true });
}

// Generate a sample SVG converted to base64 JPEG fallback or create a placeholder image
function createPlaceholderImageBase64(label: string, color: string): string {
  // Simple 1x1 or SVG data url is fine, but let's provide a real data url or canvas buffer
  // We can write a minimal valid 1x1 JPEG buffer or standard SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="${color}"/>
    <rect x="20" y="20" width="560" height="360" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 5" rx="16"/>
    <circle cx="300" cy="180" r="60" fill="#ffffff" opacity="0.2"/>
    <text x="300" y="190" fill="#ffffff" font-size="32" font-family="sans-serif" font-weight="bold" text-anchor="middle">${label}</text>
    <text x="300" y="230" fill="#ffffff" font-size="18" font-family="sans-serif" text-anchor="middle" opacity="0.8">Vistoria Veicular</text>
  </svg>`;
  return Buffer.from(svg).toString('base64');
}

// Ensure CSV exists and initialize clean without seed
function initializeStorage() {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, CSV_HEADER + '\n', 'utf-8');
    console.log('Arquivo Registros.csv criado com sucesso (Base limpa - Zero Data).');

    // seedInitialRecords(); - Desativado para inicialização 100% limpa
  } else {
    // If file exists but is empty or missing header
    const content = fs.readFileSync(CSV_FILE, 'utf-8').trim();
    if (!content) {
      fs.writeFileSync(CSV_FILE, CSV_HEADER + '\n', 'utf-8');
      // seedInitialRecords(); - Desativado para inicialização 100% limpa
    } else {
      // Check if header needs migration to include NOME_BLITZ
      const lines = content.split(/\r?\n/);
      const firstLine = lines[0] || '';
      if (!firstLine.toUpperCase().includes('BLITZ')) {
        const existingRecords = readAllRegistros();
        writeAllRegistros(existingRecords);
        console.log('Registros.csv migrado para incluir NOME_BLITZ.');
      }
    }
  }
}

function savePhotoFile(id: string, placa: string, photoIndex: 1 | 2 | 3 | 4, base64Data: string): string {
  const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanId = String(id).trim();
  const folderTag = `(${cleanId}_${cleanPlaca})`;
  const targetDir = path.join(FOTOS_DIR, folderTag);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Also support non-parenthesis directory alias if needed
  const altDir = path.join(FOTOS_DIR, `${cleanId}_${cleanPlaca}`);
  if (!fs.existsSync(altDir)) {
    try {
      fs.mkdirSync(altDir, { recursive: true });
    } catch {}
  }

  const fileName = `${folderTag}_foto${photoIndex}.jpg`;
  const filePath = path.join(targetDir, fileName);

  // Strip possible base64 header (e.g. data:image/jpeg;base64,)
  let rawBase64 = base64Data;
  if (base64Data.includes(',')) {
    rawBase64 = base64Data.split(',')[1];
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  fs.writeFileSync(filePath, buffer);

  // Also write to altDir for maximum compatibility
  try {
    fs.writeFileSync(path.join(altDir, `${cleanId}_${cleanPlaca}_foto${photoIndex}.jpg`), buffer);
    fs.writeFileSync(path.join(altDir, fileName), buffer);
  } catch {}

  // Return relative path standard format
  return `RegistroFotos/${folderTag}/${fileName}`;
}

function seedInitialRecords() {
  const today = new Date().toISOString().split('T')[0];
  const sample1Placa = 'BRA2E19';
  const sample2Placa = 'RIO4A22';

  // Seed Record 1 - APROVADO
  const f1_1 = savePhotoFile('1', sample1Placa, 1, createPlaceholderImageBase64('FRENTE - APROVADO', '#15803d'));
  const f1_2 = savePhotoFile('1', sample1Placa, 2, createPlaceholderImageBase64('TRASEIRA - APROVADO', '#166534'));
  const row1 = `1;Operação Trânsito Seguro;${today};09:30;${sample1Placa};${f1_1};${f1_2};APROVADO`;

  // Seed Record 2 - REPROVADO
  const f2_1 = savePhotoFile('2', sample2Placa, 1, createPlaceholderImageBase64('FRENTE - REPROVADO', '#b91c1c'));
  const f2_2 = savePhotoFile('2', sample2Placa, 2, createPlaceholderImageBase64('DETALHE AVARIA', '#991b1b'));
  const row2 = `2;Blitz Lei Seca;${today};14:15;${sample2Placa};${f2_1};${f2_2};REPROVADO`;

  fs.appendFileSync(CSV_FILE, row1 + '\n' + row2 + '\n', 'utf-8');
  console.log('Registros iniciais semeados em Registros.csv');
}

export interface RegistroRecord {
  id: string;
  nomeBlitz?: string;
  dia: string;
  hora: string;
  placa: string;
  foto1: string;
  foto2: string;
  foto3?: string;
  foto4?: string;
  status: 'Teste Em Andamento' | 'APROVADO' | 'REPROVADO';
}

function readAllRegistros(): RegistroRecord[] {
  if (!fs.existsSync(CSV_FILE)) {
    initializeStorage();
  }

  const content = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  // Determine delimiter from first line (standard is ';' or fallback to '|')
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : '|';
  const headerParts = headerLine.split(delimiter).map(p => p.trim().toUpperCase());

  const blitzIndex = headerParts.findIndex(h => h.includes('BLITZ'));
  const diaIndex = headerParts.indexOf('DIA');
  const horaIndex = headerParts.indexOf('HORA');
  const placaIndex = headerParts.indexOf('PLACA');
  const foto1Index = headerParts.indexOf('FOTO1');
  const foto2Index = headerParts.indexOf('FOTO2');
  const statusIndex = headerParts.indexOf('STATUS');

  const records: RegistroRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(delimiter).map(p => p.trim());
    if (parts.length >= 4) {
      let blitzVal = '';
      let diaVal = '';
      let horaVal = '';
      let placaVal = '';
      let foto1Val = '';
      let foto2Val = '';
      let statusVal = 'APROVADO';

      if (blitzIndex !== -1) {
        blitzVal = parts[blitzIndex] || '';
        diaVal = diaIndex !== -1 ? parts[diaIndex] || '' : '';
        horaVal = horaIndex !== -1 ? parts[horaIndex] || '' : '';
        placaVal = placaIndex !== -1 ? parts[placaIndex] || '' : '';
        foto1Val = foto1Index !== -1 ? parts[foto1Index] || '' : '';
        foto2Val = foto2Index !== -1 ? parts[foto2Index] || '' : '';
        statusVal = statusIndex !== -1 ? parts[statusIndex] || 'APROVADO' : 'APROVADO';
      } else {
        // Old 7-column format: ID;DIA;HORA;PLACA;FOTO1;FOTO2;STATUS
        diaVal = parts[1] || '';
        horaVal = parts[2] || '';
        placaVal = parts[3] || '';
        foto1Val = parts[4] || '';
        foto2Val = parts[5] || '';
        statusVal = parts[6] || 'APROVADO';
      }

      const cleanUpperStatus = statusVal.toUpperCase().trim();
      let normalizedStatus: 'Teste Em Andamento' | 'APROVADO' | 'REPROVADO' = 'APROVADO';
      if (cleanUpperStatus === 'REPROVADO') {
        normalizedStatus = 'REPROVADO';
      } else if (cleanUpperStatus.includes('ANDAMENTO') || cleanUpperStatus.includes('TESTE')) {
        normalizedStatus = 'Teste Em Andamento';
      }

      records.push({
        id: parts[0] || String(i),
        nomeBlitz: blitzVal,
        dia: diaVal,
        hora: horaVal,
        placa: placaVal.toUpperCase(),
        foto1: foto1Val,
        foto2: foto2Val,
        status: normalizedStatus
      });
    }
  }

  return records;
}

function writeAllRegistros(records: RegistroRecord[]) {
  const lines = [CSV_HEADER];
  for (const r of records) {
    const safeBlitz = (r.nomeBlitz || '').replace(/;/g, ' ').trim();
    lines.push(`${r.id};${safeBlitz};${r.dia};${r.hora};${r.placa.toUpperCase()};${r.foto1};${r.foto2};${r.status}`);
  }
  fs.writeFileSync(CSV_FILE, lines.join('\n') + '\n', 'utf-8');
}

async function startServer() {
  initializeStorage();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static serving of RegistroFotos
  app.use('/RegistroFotos', express.static(FOTOS_DIR));

  // Fallback endpoint for serving photo files safely
  app.get('/api/foto-file/*', (req: Request, res: Response) => {
    const relativePath = req.params[0];
    const safePath = path.join(FOTOS_DIR, relativePath);
    if (fs.existsSync(safePath)) {
      res.sendFile(safePath);
    } else {
      res.status(404).send('Foto não encontrada');
    }
  });

  // GET all registros
  app.get('/api/registros', (req: Request, res: Response) => {
    try {
      const records = readAllRegistros();
      res.json({ success: true, data: records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET single registro
  app.get('/api/registros/:id', (req: Request, res: Response) => {
    try {
      const records = readAllRegistros();
      const record = records.find(r => r.id === req.params.id);
      if (!record) {
        return res.status(404).json({ success: false, error: 'Registro não encontrado' });
      }
      res.json({ success: true, data: record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST create registro
  app.post('/api/registros', (req: Request, res: Response) => {
    try {
      const { nomeBlitz, dia, hora, placa, status, foto1Base64, foto2Base64 } = req.body;

      if (!dia || !hora || !placa || !status) {
        return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes: dia, hora, placa ou status' });
      }

      const cleanPlaca = String(placa).trim().toUpperCase();
      const cleanStatus = status === 'REPROVADO' ? 'REPROVADO' : 'APROVADO';
      const cleanBlitz = nomeBlitz ? String(nomeBlitz).trim() : '';

      const records = readAllRegistros();
      // Calculate next ID
      let maxId = 0;
      for (const r of records) {
        const num = parseInt(r.id, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
      const nextId = String(maxId + 1);

      // Save photos if provided
      let foto1Path = '';
      let foto2Path = '';

      if (foto1Base64) {
        foto1Path = savePhotoFile(nextId, cleanPlaca, 1, foto1Base64);
      } else {
        // Create an initial placeholder
        foto1Path = savePhotoFile(nextId, cleanPlaca, 1, createPlaceholderImageBase64(`FOTO 1 - ${cleanPlaca}`, cleanStatus === 'APROVADO' ? '#15803d' : '#b91c1c'));
      }

      if (foto2Base64) {
        foto2Path = savePhotoFile(nextId, cleanPlaca, 2, foto2Base64);
      } else {
        foto2Path = savePhotoFile(nextId, cleanPlaca, 2, createPlaceholderImageBase64(`FOTO 2 - ${cleanPlaca}`, cleanStatus === 'APROVADO' ? '#166534' : '#991b1b'));
      }

      const newRecord: RegistroRecord = {
        id: nextId,
        nomeBlitz: cleanBlitz,
        dia: dia.trim(),
        hora: hora.trim(),
        placa: cleanPlaca,
        foto1: foto1Path,
        foto2: foto2Path,
        status: cleanStatus
      };

      records.push(newRecord);
      writeAllRegistros(records);

      res.status(201).json({ success: true, data: newRecord });
    } catch (err: any) {
      console.error('Erro ao criar registro:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT update registro
  app.put('/api/registros/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nomeBlitz, dia, hora, placa, status, foto1Base64, foto2Base64 } = req.body;

      const records = readAllRegistros();
      const index = records.findIndex(r => r.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Registro não encontrado' });
      }

      const current = records[index];
      const updatedPlaca = placa ? String(placa).trim().toUpperCase() : current.placa;
      const updatedStatus = status === 'REPROVADO' ? 'REPROVADO' : 'APROVADO';
      const updatedBlitz = nomeBlitz !== undefined ? String(nomeBlitz).trim() : (current.nomeBlitz || '');

      let foto1Path = current.foto1;
      let foto2Path = current.foto2;

      if (foto1Base64) {
        foto1Path = savePhotoFile(id, updatedPlaca, 1, foto1Base64);
      }
      if (foto2Base64) {
        foto2Path = savePhotoFile(id, updatedPlaca, 2, foto2Base64);
      }

      const updatedRecord: RegistroRecord = {
        id,
        nomeBlitz: updatedBlitz,
        dia: dia ? dia.trim() : current.dia,
        hora: hora ? hora.trim() : current.hora,
        placa: updatedPlaca,
        foto1: foto1Path,
        foto2: foto2Path,
        status: updatedStatus
      };

      records[index] = updatedRecord;
      writeAllRegistros(records);

      res.json({ success: true, data: updatedRecord });
    } catch (err: any) {
      console.error('Erro ao atualizar registro:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE registro
  app.delete('/api/registros/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const records = readAllRegistros();
      const filtered = records.filter(r => r.id !== id);

      if (filtered.length === records.length) {
        return res.status(404).json({ success: false, error: 'Registro não encontrado' });
      }

      writeAllRegistros(filtered);
      res.json({ success: true, message: 'Registro excluído com sucesso' });
    } catch (err: any) {
      console.error('Erro ao excluir registro:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Download raw CSV
  app.get('/api/export/csv', (req: Request, res: Response) => {
    try {
      if (!fs.existsSync(CSV_FILE)) {
        initializeStorage();
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Registros.csv"');
      res.sendFile(CSV_FILE);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // GET storage folders structure for RegistroFotos
  app.get('/api/storage/folders', (req: Request, res: Response) => {
    try {
      if (!fs.existsSync(FOTOS_DIR)) {
        fs.mkdirSync(FOTOS_DIR, { recursive: true });
      }

      const items = fs.readdirSync(FOTOS_DIR);
      const folders: any[] = [];

      for (const item of items) {
        const itemPath = path.join(FOTOS_DIR, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            const fileNames = fs.readdirSync(itemPath);
            const files: any[] = [];

            for (const file of fileNames) {
              const filePath = path.join(itemPath, file);
              try {
                const fileStat = fs.statSync(filePath);
                if (fileStat.isFile()) {
                  files.push({
                    fileName: file,
                    filePath: `RegistroFotos/${item}/${file}`,
                    url: `/RegistroFotos/${encodeURIComponent(item)}/${encodeURIComponent(file)}`,
                    size: fileStat.size,
                    modifiedAt: fileStat.mtime.toISOString(),
                  });
                }
              } catch {}
            }

            folders.push({
              folderName: item,
              folderPath: `RegistroFotos/${item}`,
              files,
            });
          }
        } catch {}
      }

      // Sort folders so newest or alphabetical order is clean
      folders.sort((a, b) => a.folderName.localeCompare(b.folderName));

      res.json({
        success: true,
        rootFolder: 'RegistroFotos',
        totalFolders: folders.length,
        totalFiles: folders.reduce((acc, f) => acc + f.files.length, 0),
        data: folders,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET complete ZIP download of RegistroFotos folder with all subfolders + Registros.csv
  app.get('/api/storage/zip', async (req: Request, res: Response) => {
    try {
      const zip = new JSZip();

      // Include Registros.csv if exists
      if (fs.existsSync(CSV_FILE)) {
        zip.file('Registros.csv', fs.readFileSync(CSV_FILE));
      }

      // Include all subfolders and photos from RegistroFotos
      if (fs.existsSync(FOTOS_DIR)) {
        const items = fs.readdirSync(FOTOS_DIR);
        for (const folder of items) {
          const folderPath = path.join(FOTOS_DIR, folder);
          try {
            if (fs.statSync(folderPath).isDirectory()) {
              const subFiles = fs.readdirSync(folderPath);
              for (const file of subFiles) {
                const filePath = path.join(folderPath, file);
                try {
                  if (fs.statSync(filePath).isFile()) {
                    // Store inside RegistroFotos/folder/file structure in ZIP
                    zip.file(`RegistroFotos/${folder}/${file}`, fs.readFileSync(filePath));
                  }
                } catch {}
              }
            }
          } catch {}
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="RegistroFotos_Download.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Erro ao gerar ZIP das fotos:', err);
      res.status(500).send('Erro ao gerar arquivo zip: ' + err.message);
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();

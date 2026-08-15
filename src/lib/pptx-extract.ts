// Minimal client-side text extractor for PPTX/PPT/DOCX files.
// PPTX and DOCX are ZIP archives containing XML; we parse the ZIP
// structure manually and inflate slide/paragraph XML using the
// browser's built-in DecompressionStream('deflate-raw').

interface ZipEntry {
  name: string;
  compressedOffset: number;
  compressedSize: number;
  compressionMethod: number;
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const view = new DataView(bytes.buffer);
  // Scan for local file header signature: 0x504B0304
  for (let i = 0; i < bytes.length - 4; i++) {
    if (view.getUint32(i, true) === 0x04034b50) {
      const nameLen = readUint16(view, i + 26);
      const extraLen = readUint16(view, i + 28);
      const method = readUint16(view, i + 8);
      const compSize = readUint32(view, i + 18);
      const nameStart = i + 30;
      let name = '';
      for (let j = 0; j < nameLen; j++) {
        name += String.fromCharCode(bytes[nameStart + j]);
      }
      const dataOffset = nameStart + nameLen + extraLen;
      entries.push({ name, compressedOffset: dataOffset, compressedSize: compSize, compressionMethod: method });
      i = dataOffset + compSize - 1;
    }
  }
  return entries;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractPptxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const entries = findEntries(bytes);
  const slideEntries = entries
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.name))
    .sort((a, b) => {
      const na = parseInt(a.name.match(/slide(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.name.match(/slide(\d+)/)?.[1] ?? '0', 10);
      return na - nb;
    });

  const slides: string[] = [];
  for (const entry of slideEntries) {
    const comp = bytes.slice(entry.compressedOffset, entry.compressedOffset + entry.compressedSize);
    let xml: string;
    if (entry.compressionMethod === 0) {
      xml = new TextDecoder().decode(comp);
    } else if (entry.compressionMethod === 8) {
      const inflated = await inflateRaw(comp);
      xml = new TextDecoder().decode(inflated);
    } else {
      continue;
    }
    const text = stripXml(xml);
    if (text) slides.push(text);
  }
  return slides.map((s, i) => `--- Slide ${i + 1} ---\n${s}`).join('\n\n');
}

export async function extractDocxText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const entries = findEntries(bytes);
  const docEntry = entries.find(e => e.name === 'word/document.xml');
  if (!docEntry) return '';
  const comp = bytes.slice(docEntry.compressedOffset, docEntry.compressedOffset + docEntry.compressedSize);
  let xml: string;
  if (docEntry.compressionMethod === 0) {
    xml = new TextDecoder().decode(comp);
  } else if (docEntry.compressionMethod === 8) {
    const inflated = await inflateRaw(comp);
    xml = new TextDecoder().decode(inflated);
  } else {
    return '';
  }
  return stripXml(xml);
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = new TextDecoder('latin1').decode(bytes);
    // Extract text between BT and ET markers
    const streams: string[] = [];
    const regex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      // Extract text from Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        streams.push(tjMatch[1]);
      }
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
      let tjArrayMatch: RegExpExecArray | null;
      while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
        const parts = tjArrayMatch[1].match(/\(([^)]*)\)/g);
        if (parts) parts.forEach(p => streams.push(p.slice(1, -1)));
      }
    }
    const result = streams.join(' ').replace(/\\[nrt()]/g, ' ').replace(/\s+/g, ' ').trim();
    return result || `[Uploaded: ${file.name} — PDF text extraction limited. Please paste key points.]`;
  } catch {
    return `[Uploaded: ${file.name} — PDF text could not be extracted. Please paste key points.]`;
  }
}

export function isAudioVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return /\.(mp3|wav|m4a|ogg|webm|mp4|mov|avi|mkv)$/i.test(name) || file.type.startsWith('audio/') || file.type.startsWith('video/');
}

export async function extractAudioVideoText(file: File): Promise<string> {
  // Programmatic STT using Web Speech API — plays the audio and uses
  // SpeechRecognition to transcribe. Falls back to a placeholder if unsupported.
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    return `[Uploaded: ${file.name} — audio/video transcription not supported in this browser. Please paste key points into session notes.]`;
  }
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(file);
    audio.style.display = 'none';
    document.body.appendChild(audio);
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    let transcript = '';
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      URL.revokeObjectURL(audio.src);
      audio.remove();
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
    recognition.onresult = (e: any) => {
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + ' ';
      }
    };
    recognition.onerror = () => {
      cleanup();
      resolve(transcript.trim() || `[Uploaded: ${file.name} — audio transcription incomplete. Please paste key points.]`);
    };
    recognition.onend = () => {
      cleanup();
      resolve(transcript.trim() || `[Uploaded: ${file.name} — no speech detected. Please paste key points.]`);
    };
    audio.onloadedmetadata = () => {
      audio.play().then(() => {
        recognition.start();
        timeoutHandle = setTimeout(() => {
          try { recognition.stop(); } catch { /* */ }
        }, Math.min((audio.duration + 5) * 1000, 300000));
      }).catch(() => {
        cleanup();
        resolve(`[Uploaded: ${file.name} — could not play audio for transcription. Please paste key points.]`);
      });
    };
    audio.onerror = () => {
      cleanup();
      resolve(`[Uploaded: ${file.name} — audio file could not be loaded. Please paste key points.]`);
    };
  });
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  try {
    if (name.match(/\.pptx?$/i)) return await extractPptxText(file);
    if (name.match(/\.docx?$/i)) return await extractDocxText(file);
    if (name.match(/\.pdf$/i)) return await extractPdfText(file);
    if (name.match(/\.txt$|\.csv$|\.md$/i)) return await file.text();
    if (isAudioVideoFile(file)) return await extractAudioVideoText(file);
  } catch { /* fall through */ }
  return `[Uploaded: ${file.name} — content could not be extracted automatically. Please paste key points into session notes.]`;
}

export async function extractOfficeText(file: File): Promise<string> {
  return extractFileText(file);
}

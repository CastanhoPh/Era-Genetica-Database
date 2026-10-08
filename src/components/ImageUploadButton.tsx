import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseStorage';

interface ImageUploadButtonProps {
  /** Prefixo de pasta no Storage, sem barra final (ex: "Characters/01 - Nome" ou "Characters/01 - Nome/Galeria/Eventos"). */
  pathPrefix: string;
  /** Nome final do arquivo, sem extensão (ex: nome do personagem ou da técnica). Se omitido, usa um nome baseado em timestamp. */
  fileName?: string;
  onUploaded: (url: string) => void;
  className?: string;
  /** Quando true, mostra só o ícone (sem o texto "Upload"/"Enviando..."), útil em botões compactos. */
  iconOnly?: boolean;
}

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({ pathPrefix, fileName, onUploaded, className, iconOnly }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '';
      const finalName = fileName ? `${sanitize(fileName)}${ext}` : `${Date.now()}-${sanitize(file.name)}`;
      const path = `${pathPrefix}/${finalName}`;
      const storageRef = ref(storage, path);
      // Cache de 1 dia: elimina o recarregamento repetido ao trocar de aba/reabrir a
      // ficha, mas ainda se autocorrige rápido se a imagem for substituída depois.
      await uploadBytes(storageRef, file, { contentType: file.type, cacheControl: 'public, max-age=86400' });
      const url = await getDownloadURL(storageRef);
      // Como o caminho não muda quando uma imagem é substituída, o link também não mudaria
      // sem isso — e com cache de 1 dia, navegador/CDN continuariam servindo a versão antiga.
      // Um parâmetro de versão único por upload garante que o link sempre aponte pro conteúdo atual.
      const urlWithVersion = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
      onUploaded(urlWithVersion);
    } catch (e) {
      console.error('Erro no upload da imagem:', e);
      setError('Falha no upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={className ?? 'inline-flex items-center gap-1 px-2 py-1 border border-tech-primary/40 text-tech-primary text-[9px] uppercase hover:bg-tech-primary hover:text-black transition-colors disabled:opacity-50'}
      >
        {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
        {!iconOnly && (uploading ? 'Enviando...' : 'Upload')}
      </button>
      {error && <span className="text-red-500 text-[9px]">{error}</span>}
    </div>
  );
};

export default ImageUploadButton;

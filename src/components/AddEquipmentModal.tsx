import React, { useState } from 'react';
import { X, Save, Image as ImageIcon, Shield, Loader } from 'lucide-react';
import { Equipment } from '../types/Equipment';
import { formatImageUrl } from '../utils/formatters';
import ImageUploadButton from './ImageUploadButton';

interface AddEquipmentModalProps {
  onClose: () => void;
  onSave: (item: Equipment) => Promise<void>;
  initialEquipment?: Equipment | null;
}

const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({ onClose, onSave, initialEquipment }) => {
  const isEditing = !!initialEquipment;
  const [form, setForm] = useState({
    name: initialEquipment?.name || '',
    image: initialEquipment?.image || '',
    classification: initialEquipment?.classification || '',
    nature: initialEquipment?.nature || '',
    origin: initialEquipment?.origin || '',
    originalOwner: initialEquipment?.originalOwner || '',
    pastOwners: (initialEquipment?.pastOwners || []).join(', '),
    currentOwner: initialEquipment?.currentOwner || '',
    variants: (initialEquipment?.variants || []).map(v => v.description ? `${v.name} | ${v.owner} | ${v.description}` : `${v.name} | ${v.owner}`).join('\n'),
    description: initialEquipment?.description || '',
  });
  const [previewError, setPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome da arma.');
      return;
    }
    setError(null);
    setSaving(true);
    const item: Equipment = {
      id: initialEquipment ? initialEquipment.id : Date.now(),
      ...(initialEquipment?.docId ? { docId: initialEquipment.docId } : {}),
      name: form.name.trim(),
      classification: form.classification,
      nature: form.nature,
      origin: form.origin,
      description: form.description,
      image: form.image,
      originalOwner: form.originalOwner,
      pastOwners: form.pastOwners.split(',').map(s => s.trim()).filter(Boolean),
      currentOwner: form.currentOwner,
      variants: form.variants
        .split('\n')
        .map(line => {
          const [name, owner, description] = line.split('|').map(s => s.trim());
          if (!name || !owner) return null;
          // Preserva a imagem de uma variação já existente com o mesmo nome — este
          // formulário não sabe fazer upload de imagem por variação ainda.
          const existing = initialEquipment?.variants?.find(v => v.name.trim().toLowerCase() === name.toLowerCase());
          return { ...(existing ?? {}), name, owner, ...(description ? { description } : {}) };
        })
        .filter((v): v is { name: string; owner: string; image?: string } => v !== null),
    };
    try {
      await onSave(item);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar arma:', err);
      setError('Não foi possível salvar. Verifique o login de admin e a conexão.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-[#050a05] border border-tech-primary/30 p-2 text-white text-xs focus:border-tech-primary focus:bg-black focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] outline-none transition-all placeholder:text-white/10";
  const labelClass = "text-[10px] font-bold text-tech-primary/80 uppercase block mb-1 tracking-wider";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-tech-bg border-2 border-tech-primary shadow-[0_0_40px_rgba(0,255,65,0.1)] flex flex-col my-8 max-h-[90vh] clip-corner">
        <div className="p-3 bg-tech-primary/10 border-b border-tech-primary flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-tech-primary flex items-center gap-2 uppercase tracking-widest">
            <Shield size={18} /> {isEditing ? `Editar: ${form.name || 'Arma'}` : 'Nova Arma'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-red-500 hover:text-black text-red-500 border border-transparent hover:border-red-500 transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar">
          {/* Preview */}
          <div className="space-y-3">
            <div className="aspect-square w-full bg-black border border-tech-primary/30 flex items-center justify-center relative overflow-hidden">
              {form.image && !previewError ? (
                <img src={formatImageUrl(form.image)} alt="Preview" className="w-full h-full object-cover opacity-80" onError={() => setPreviewError(true)} />
              ) : (
                <div className="text-center p-6 text-tech-primary/40">
                  <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                  <span className="text-[10px] uppercase">Aguardando Imagem...</span>
                </div>
              )}
              <div className="absolute bottom-0 w-full bg-tech-primary/20 text-center text-[10px] text-tech-primary py-1 uppercase">PREVIEW</div>
            </div>
            <div>
              <label className={labelClass}>URL da Imagem</label>
              <div className="flex gap-2">
                <input name="image" value={form.image} onChange={handleChange} className={inputClass} placeholder="https://..." />
                <ImageUploadButton
                  pathPrefix={isEditing && initialEquipment ? 'Arsenal' : 'Uploads/arsenal'}
                  fileName={isEditing && initialEquipment ? `${String(initialEquipment.id).padStart(2, '0')} - ${form.name.trim()}` : undefined}
                  onUploaded={(url) => setForm(prev => ({ ...prev, image: url }))}
                />
              </div>
            </div>
          </div>

          {/* Campos */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className={labelClass}>Nome</label>
              <input name="name" value={form.name} onChange={handleChange} className={inputClass} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Classificação</label><input name="classification" value={form.classification} onChange={handleChange} className={inputClass} placeholder="Z, S++, A..." /></div>
              <div><label className={labelClass}>Origem</label><input name="origin" value={form.origin} onChange={handleChange} className={inputClass} placeholder="Konohagakure..." /></div>
            </div>
            <div>
              <label className={labelClass}>Natureza</label>
              <input name="nature" value={form.nature} onChange={handleChange} className={inputClass} placeholder="Raiton + Fuinjutsu..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Portador Original</label><input name="originalOwner" value={form.originalOwner} onChange={handleChange} className={inputClass} placeholder="Nome do personagem" /></div>
              <div><label className={labelClass}>Portadores Antigos</label><input name="pastOwners" value={form.pastOwners} onChange={handleChange} className={inputClass} placeholder="Nome1, Nome2... (entre o original e o atual)" /></div>
              <div><label className={labelClass}>Portador Atual</label><input name="currentOwner" value={form.currentOwner} onChange={handleChange} className={inputClass} placeholder="Nome do personagem (o site prioriza o que estiver no arsenal da ficha, isso aqui é só reserva)" /></div>
            </div>
            <div>
              <label className={labelClass}>Variações (mesma arma, outro portador)</label>
              <textarea
                name="variants"
                value={form.variants}
                onChange={handleChange}
                className={`${inputClass} h-20 resize-none font-mono`}
                placeholder={'Uma por linha: Nome da variação | Portador | Descrição (opcional)\nEx: Shiden no Kage | Naomi Uzumaki'}
              />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea name="description" value={form.description} onChange={handleChange} className={`${inputClass} h-32 resize-none`} />
            </div>

            {error && <div className="text-red-400 text-xs border border-red-500/40 bg-red-500/10 p-2">{error}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2 border border-tech-dim text-tech-dim hover:text-white hover:border-white uppercase text-xs disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-tech-primary text-black font-bold uppercase text-xs hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Salvando...' : 'Salvar no banco'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEquipmentModal;

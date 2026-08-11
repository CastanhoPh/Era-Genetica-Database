import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Info, Terminal, Skull, Backpack, Fingerprint, Activity, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { Character, Technique, GalleryImage, EVENT_SEASONS } from '../types';
import { Equipment } from '../types/Equipment';
import { formatImageUrl } from '../utils/formatters';
import ImageUploadButton from './ImageUploadButton';

interface AddCharacterModalProps {
  onClose: () => void;
  onAdd: (char: Character) => Promise<void>;
  initialCharacter?: Character | null;
  arsenalOptions?: Equipment[];
}

interface FormData {
  name: string;
  clan: string;
  position: string;
  role: string;
  nc: string | number;
  hp: string | number;
  chakra: string | number;
  description: string;
  image: string;
  strength: string | number;
  dexterity: string | number;
  agility: string | number;
  intelligence: string | number;
  spirit: string | number;
  vigor: string | number;
  perception: string | number;
  categories: string[];
  titles: string;
  powers: string;
  aptitudes: string;
  isDead: boolean;
  killedBy: string;
}



const AddCharacterModal: React.FC<AddCharacterModalProps> = ({ onClose, onAdd, initialCharacter, arsenalOptions = [] }) => {
  const isEditing = !!initialCharacter;
  const arsenalData = arsenalOptions;
  const [formData, setFormData] = useState<FormData>(() => initialCharacter ? {
    name: initialCharacter.name || '',
    clan: initialCharacter.clan || '',
    position: initialCharacter.position || '',
    role: initialCharacter.role || '',
    nc: initialCharacter.nc ?? 4,
    hp: initialCharacter.hp ?? 100,
    chakra: initialCharacter.chakra ?? 100,
    description: initialCharacter.description || '',
    image: initialCharacter.image || '',
    strength: initialCharacter.stats?.strength ?? 5,
    dexterity: initialCharacter.stats?.dexterity ?? 5,
    agility: initialCharacter.stats?.agility ?? 5,
    intelligence: initialCharacter.stats?.intelligence ?? 5,
    spirit: initialCharacter.stats?.spirit ?? 5,
    vigor: initialCharacter.stats?.vigor ?? 5,
    perception: initialCharacter.stats?.perception ?? 5,
    categories: initialCharacter.categories || ['Personagem'],
    titles: (initialCharacter.titles || []).join(', '),
    powers: (initialCharacter.powers || []).map(p => `${p.name}: ${p.level}`).join('\n'),
    aptitudes: (initialCharacter.aptitudes || []).join(', '),
    isDead: !!initialCharacter.isDead,
    killedBy: initialCharacter.killedBy || '',
  } : {
    name: '', clan: '', position: '', role: '', nc: 4, hp: 100, chakra: 100, description: '', image: '',
    strength: 5, dexterity: 5, agility: 5, intelligence: 5, spirit: 5, vigor: 5, perception: 5,
    categories: ['Personagem'], titles: '', powers: '', aptitudes: '',
    isDead: false, killedBy: ''
  });
  const [techniques, setTechniques] = useState<Technique[]>(initialCharacter?.techniques || []);
  const [arsenal, setArsenal] = useState<number[]>(initialCharacter?.arsenal || []);
  const [gallery, setGallery] = useState<GalleryImage[]>(initialCharacter?.gallery || []);
  const [generatedJson, setGeneratedJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'pessoal' | 'ficha' | 'jutsus' | 'galeria'>('pessoal');
  const [formError, setFormError] = useState<string | null>(null);

  const sections = [
    { key: 'pessoal' as const, label: 'Pessoal', icon: Fingerprint },
    { key: 'ficha' as const, label: 'Ficha', icon: Activity },
    { key: 'jutsus' as const, label: 'Jutsus e Arsenal', icon: Backpack },
    { key: 'galeria' as const, label: 'Galeria', icon: Images },
  ];
  const sectionIndex = sections.findIndex(s => s.key === activeSection);

  const categoriesOptions = ['Personagem', 'NPC', 'Konohagakure', 'Kirigakure', 'Kumogakure', 'Sunagakure', 'Iwagakure', 'OCA'];

  const statsConfig = [
    { key: 'strength', label: 'FORÇA' },
    { key: 'agility', label: 'AGILIDADE' },
    { key: 'dexterity', label: 'DESTREZA' },
    { key: 'perception', label: 'PERCEPÇÃO' },
    { key: 'intelligence', label: 'INTELIGÊNCIA' },
    { key: 'vigor', label: 'VIGOR' },
    { key: 'spirit', label: 'ESPÍRITO' },
  ];

  useEffect(() => {
    setPreviewError(false);
  }, [formData.image]);

  // Prevent scroll on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        if (name === 'isDead') {
             setFormData({ ...formData, isDead: checked });
        } else {
            const updatedCats = checked 
                ? [...formData.categories, value] 
                : formData.categories.filter(c => c !== value);
            setFormData({ ...formData, categories: updatedCats });
        }
    } else {
        setFormData({ ...formData, [name]: value });
    }
  };

  const handleTechniqueChange = (index: number, field: keyof Technique, value: string) => {
    const newTechs = [...techniques];
    newTechs[index] = { ...newTechs[index], [field]: value };
    setTechniques(newTechs);
  };

  const addTechnique = () => {
    setTechniques([...techniques, { name: '' }]);
  };

  const removeTechnique = (index: number) => {
    setTechniques(techniques.filter((_, i) => i !== index));
  };

  // Pasta real do personagem no Storage (mesma convenção da migração: "Characters/<id> - Nome").
  // Só existe uma pasta definitiva quando o personagem já foi salvo antes (edição) — nesse
  // caso o ID é estável. Criando um personagem novo, ainda não há ID, então cai num fallback
  // genérico só até o primeiro salvamento.
  const characterFolderPrefix = (): string | null => {
    if (!isEditing || !initialCharacter || !formData.name.trim()) return null;
    const paddedId = String(initialCharacter.id).padStart(2, '0');
    return `Characters/${paddedId} - ${formData.name.trim().replace(/\//g, '-')}`;
  };

  const galleryPathPrefix = (img: GalleryImage) => {
    const base = characterFolderPrefix();
    if (img.category === 'evento') {
      const seasonFolder = img.season || EVENT_SEASONS[0];
      return base ? `${base}/Galeria/Eventos/${seasonFolder}` : `Uploads/gallery/Eventos/${seasonFolder}`;
    }
    return base ? `${base}/Galeria/Linha do Tempo` : `Uploads/gallery/Linha do Tempo`;
  };

  const handleGalleryChange = (index: number, field: keyof GalleryImage, value: string) => {
    const newGallery = [...gallery];
    newGallery[index] = { ...newGallery[index], [field]: value };
    setGallery(newGallery);
  };

  const addGalleryImage = () => {
    setGallery([...gallery, { url: '', caption: '', category: 'era' }]);
  };

  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, i) => i !== index));
  };

  const addWeapon = (id: number) => {
    if (!arsenal.includes(id)) {
      setArsenal([...arsenal, id]);
    }
  };

  const removeWeapon = (id: number) => {
    setArsenal(arsenal.filter(wId => wId !== id));
  };

  const parseStat = (value: string | number): string | number => {
    if (String(value).trim() === '?' || String(value).trim() === '？') return '?';
    return Number(value);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
        setActiveSection('pessoal');
        setFormError('Informe o nome do personagem (aba Pessoal).');
        return;
    }
    setFormError(null);

    const powersArray = formData.powers.split('\n').filter(p => p.trim()).map(p => {
        const parts = p.split(':');
        const name = parts[0]?.trim();
        const levelRaw = parts[1] ? parts[1].trim() : "1";
        
        let level: string | number = 1;
        if (levelRaw === '?' || levelRaw === '？') {
            level = '?';
        } else {
            level = parseInt(levelRaw);
            if (isNaN(level)) level = 1;
        }

        return { name, level };
    });

    const newChar: Character = {
        id: initialCharacter ? initialCharacter.id : Date.now(),
        ...(initialCharacter?.docId ? { docId: initialCharacter.docId } : {}),
        name: formData.name,
        clan: formData.clan,
        categories: formData.categories,
        titles: formData.titles.split(',').map(t => t.trim()).filter(t => t),
        nc: Number(formData.nc),
        position: formData.position,
        role: formData.role,
        description: formData.description,
        hp: Number(formData.hp),
        chakra: Number(formData.chakra),
        image: formData.image,
        stats: {
            strength: parseStat(formData.strength),
            dexterity: parseStat(formData.dexterity),
            agility: parseStat(formData.agility),
            intelligence: parseStat(formData.intelligence),
            spirit: parseStat(formData.spirit),
            vigor: parseStat(formData.vigor),
            perception: parseStat(formData.perception)
        },
        powers: powersArray,
        aptitudes: formData.aptitudes.split(',').map(t => t.trim()).filter(t => t),
        isDead: formData.isDead,
        killedBy: formData.isDead ? formData.killedBy : undefined,
        techniques: techniques.filter(t => t.name.trim()),
        arsenal: arsenal,
        gallery: gallery.filter(g => g.url.trim()),
    };

    setGeneratedJson(JSON.stringify(newChar, null, 2));
  };

  const copyToClipboard = () => {
    if (generatedJson) {
        navigator.clipboard.writeText(generatedJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveToDatabase = async () => {
      if (!generatedJson) return;
      setSaving(true);
      setSaveError(null);
      try {
          await onAdd(JSON.parse(generatedJson));
          onClose();
      } catch (err) {
          console.error('Erro ao salvar no banco:', err);
          setSaveError('Não foi possível salvar no banco. Verifique o login de admin e a conexão.');
      } finally {
          setSaving(false);
      }
  };

  const inputClass = "w-full bg-[#050a05] border border-tech-primary/30 p-2 text-white text-xs focus:border-tech-primary focus:bg-black focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] outline-none uppercase transition-all placeholder:text-white/10";
  const labelClass = "text-[10px] font-bold text-tech-primary/80 uppercase block mb-1 tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
        <div className="relative w-full max-w-5xl bg-tech-bg border-2 border-tech-primary shadow-[0_0_40px_rgba(0,255,65,0.1)] flex flex-col my-8 max-h-[90vh] clip-corner">
            
            <div className="p-3 bg-tech-primary/10 border-b border-tech-primary flex justify-between items-center sticky top-0 z-20">
                <h2 className="text-lg font-bold text-tech-primary flex items-center gap-2 uppercase tracking-widest">
                    <Terminal size={18} />
                    {generatedJson ? "REVISAR_DADOS" : (isEditing ? `EDITAR: ${formData.name || 'PERSONAGEM'}` : "ENTRADA_DE_DADOS")}
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-red-500 hover:text-black text-red-500 border border-transparent hover:border-red-500 transition-all"><X size={20} /></button>
            </div>
            
            {generatedJson ? (
                <div className="p-8 flex flex-col h-full overflow-hidden">
                    <div className="bg-tech-primary/5 border border-tech-primary text-tech-primary p-4 mb-6 flex gap-3 text-xs">
                        <Info className="shrink-0" size={16} />
                        <p>CONFIRA OS DADOS ABAIXO E CLIQUE EM <strong>SALVAR NO BANCO</strong> PARA GRAVAR NO FIRESTORE.</p>
                    </div>
                    <div className="relative flex-1 bg-black border border-tech-dim p-1 overflow-hidden min-h-[350px]">
                        <textarea readOnly value={generatedJson} className="w-full h-full p-4 bg-transparent text-green-400 font-mono text-xs resize-none focus:outline-none"/>
                        <button onClick={copyToClipboard} className="absolute top-4 right-4 bg-tech-primary hover:bg-white text-black px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 border border-tech-primary">
                            {copied ? "COPIADO" : "COPIAR JSON"}
                        </button>
                    </div>
                    {saveError && (
                        <div className="mt-4 text-red-400 text-xs border border-red-500/40 bg-red-500/10 p-2">{saveError}</div>
                    )}
                    <div className="mt-6 flex justify-end gap-4">
                        <button onClick={() => setGeneratedJson(null)} disabled={saving} className="px-6 py-2 border border-tech-dim text-tech-dim hover:text-white hover:border-white uppercase text-xs disabled:opacity-50">Voltar</button>
                        <button onClick={handleSaveToDatabase} disabled={saving} className="px-6 py-2 bg-tech-primary text-black font-bold uppercase text-xs hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50">
                            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar no banco'}
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
                    {/* Barra de abas navegáveis */}
                    <div className="flex border-b border-tech-border bg-black/40 shrink-0">
                        {sections.map(s => {
                            const Icon = s.icon;
                            const active = activeSection === s.key;
                            return (
                                <button type="button" key={s.key} onClick={() => setActiveSection(s.key)}
                                    className={`flex-1 px-2 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-b-2 transition-all ${active ? 'border-tech-primary text-tech-primary bg-tech-primary/10' : 'border-transparent text-tech-primary/40 hover:text-tech-primary/70'}`}>
                                    <Icon size={12} /> {s.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">

                    {/* ====== ABA PESSOAL ====== */}
                    {activeSection === 'pessoal' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="aspect-[3/4] w-full bg-black border border-tech-primary/30 flex flex-col items-center justify-center relative group">
                            <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,rgba(0,0,0,0.5)_3px)] bg-[size:100%_4px] pointer-events-none"></div>
                            {formData.isDead && (
                                <div className="absolute top-6 -right-12 bg-red-600 text-black font-black text-xs py-1 w-40 text-center rotate-45 z-30 border border-black tracking-widest">MORTO</div>
                            )}
                            {formData.image && !previewError ? (
                                <img src={formatImageUrl(formData.image)} alt="Preview" className={`w-full h-full object-cover opacity-80 ${formData.isDead ? 'grayscale brightness-50 contrast-125' : 'grayscale'}`} onError={() => setPreviewError(true)} />
                            ) : (
                                <div className="text-center p-6 text-tech-primary/40">
                                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                                    <span className="text-[10px] uppercase">Aguardando Imagem...</span>
                                </div>
                            )}
                            <div className="absolute bottom-0 w-full bg-tech-primary/20 text-center text-[10px] text-tech-primary py-1 uppercase">PREVIEW</div>
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>URL da Imagem</label>
                            <div className="flex gap-2">
                                <input name="image" placeholder="/images/file.jpg" value={formData.image} onChange={handleChange} className={inputClass} />
                                <ImageUploadButton
                                    pathPrefix={characterFolderPrefix() ?? 'Uploads/characters'}
                                    fileName={characterFolderPrefix() ? formData.name.trim() : undefined}
                                    onUploaded={(url) => setFormData(prev => ({ ...prev, image: url }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-black bg-tech-primary p-1 pl-2 uppercase clip-corner-sm">Identificação</h3>
                        <div>
                            <label className={labelClass}>Nome</label>
                            <input name="name" value={formData.name} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>Clã</label><input name="clan" value={formData.clan} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>Rank</label><input name="position" value={formData.position} onChange={handleChange} className={inputClass} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={labelClass}>Função</label><input name="role" value={formData.role} onChange={handleChange} className={inputClass} /></div>
                            <div><label className={labelClass}>NC</label><input name="nc" type="number" value={formData.nc} onChange={handleChange} className={`${inputClass} text-tech-primary font-bold`} /></div>
                        </div>
                        <div>
                            <label className={labelClass}>Tags</label>
                            <div className="flex flex-wrap gap-2 p-2 border border-tech-primary/20 bg-black/30">
                                {categoriesOptions.map(cat => (
                                    <label key={cat} className={`flex items-center gap-1 px-2 py-1 border text-[10px] cursor-pointer hover:bg-white/5 uppercase transition-colors ${formData.categories.includes(cat) ? 'border-tech-primary text-tech-primary bg-tech-primary/10' : 'border-tech-dim text-slate-500'}`}>
                                        <input type="checkbox" name="categories" value={cat} checked={formData.categories.includes(cat)} onChange={handleChange} className="hidden" />
                                        {formData.categories.includes(cat) ? '[X]' : '[ ]'} {cat}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Bio/Descrição</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} className={`${inputClass} h-24 resize-none`} />
                        </div>
                        <div>
                            <label className={labelClass}>Títulos (CSV)</label>
                            <input name="titles" placeholder="Genin, Lider" value={formData.titles} onChange={handleChange} className={inputClass} />
                        </div>
                        <div className="bg-red-950/20 border border-red-900/50 p-2">
                             <label className={`flex items-center gap-2 text-xs font-bold uppercase cursor-pointer mb-2 ${formData.isDead ? 'text-red-500' : 'text-slate-500'}`}>
                                <input type="checkbox" name="isDead" checked={formData.isDead} onChange={handleChange} className="accent-red-500" /> <Skull size={14} /> Personagem Morto?
                             </label>
                             {formData.isDead && (
                                 <div className="animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] font-bold text-red-400 uppercase block mb-1">Morto Por (Assassino)</label>
                                    <input name="killedBy" value={formData.killedBy} onChange={handleChange} className={`${inputClass} border-red-900 text-red-500 focus:border-red-500`} placeholder="Nome" />
                                 </div>
                             )}
                        </div>
                    </div>
                    </div>
                    )}

                    {/* ====== ABA JUTSUS E ARSENAL ====== */}
                    {activeSection === 'jutsus' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-black bg-tech-primary p-1 pl-2 uppercase clip-corner-sm">Jutsus &amp; Arsenal</h3>

                        <div className="bg-tech-panel/40 border border-tech-border p-3 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-tech-primary uppercase block tracking-wider flex items-center gap-1">
                                    <Terminal size={12} /> Jutsus e Ataques
                                </label>
                                <button
                                    type="button"
                                    onClick={addTechnique}
                                    className="px-2 py-1 bg-tech-primary/10 border border-tech-primary text-tech-primary text-[8px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all"
                                >
                                    + Adicionar Jutsu
                                </button>
                            </div>

                            {techniques.map((tech, idx) => (
                                <div key={idx} className="p-3 border border-tech-border bg-black/40 space-y-3 relative">
                                    <button 
                                        type="button"
                                        onClick={() => removeTechnique(idx)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-400"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="text-[8px] text-tech-dim font-bold uppercase mb-2">Jutsu #{idx + 1}</div>
                                    
                                    <div>
                                        <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Nome:</label>
                                        <input 
                                            value={tech.name} 
                                            onChange={(e) => handleTechniqueChange(idx, 'name', e.target.value)} 
                                            className={inputClass} 
                                            placeholder="Nome da técnica"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Classificação:</label>
                                            <input 
                                                value={tech.classification || ''} 
                                                onChange={(e) => handleTechniqueChange(idx, 'classification', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="S, A, B..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Natureza:</label>
                                            <input 
                                                value={tech.nature || ''} 
                                                onChange={(e) => handleTechniqueChange(idx, 'nature', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="Katon, Raiton..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">URL da Imagem:</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={tech.image || ''}
                                                onChange={(e) => handleTechniqueChange(idx, 'image', e.target.value)}
                                                className={inputClass}
                                                placeholder="URL da imagem"
                                            />
                                            <ImageUploadButton
                                                pathPrefix={characterFolderPrefix() ? `${characterFolderPrefix()}/Tecnicas` : 'Uploads/techniques'}
                                                fileName={characterFolderPrefix() ? `${String(idx + 1).padStart(2, '0')} - ${tech.name.trim() || 'jutsu'}` : undefined}
                                                onUploaded={(url) => handleTechniqueChange(idx, 'image', url)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Escala de Destruição:</label>
                                            <input 
                                                value={tech.destruction || ''} 
                                                onChange={(e) => handleTechniqueChange(idx, 'destruction', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="Massiva, Elevada..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Status/Protocolo:</label>
                                            <input 
                                                value={tech.status || ''} 
                                                onChange={(e) => handleTechniqueChange(idx, 'status', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="Restrito, Secreto..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Descrição:</label>
                                        <textarea 
                                            value={tech.description || ''} 
                                            onChange={(e) => handleTechniqueChange(idx, 'description', e.target.value)} 
                                            className={`${inputClass} h-16 resize-none`} 
                                            placeholder="Descrição técnica..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Notas Históricas:</label>
                                        <textarea 
                                            value={tech.history || ''} 
                                            onChange={(e) => handleTechniqueChange(idx, 'history', e.target.value)} 
                                            className={`${inputClass} h-12 resize-none`} 
                                            placeholder="Registros históricos..."
                                        />
                                    </div>
                                </div>
                            ))}

                            {techniques.length === 0 && (
                                <div className="text-center py-4 border border-dashed border-tech-dim text-[9px] text-tech-dim uppercase">
                                    Nenhum jutsu adicionado.
                                </div>
                            )}
                        </div>

                        {/* ARSENAL SECTION */}
                        <div className="bg-tech-panel/40 border border-tech-border p-3 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-tech-primary uppercase block tracking-wider flex items-center gap-1">
                                    <Backpack size={12} /> Arsenal
                                </label>
                            </div>

                            {/* ID Selector */}
                            <div className="space-y-2">
                                <label className="text-[9px] text-tech-primary/60 uppercase block mb-1">Adicionar Arsenal:</label>
                                <select 
                                    className={`${inputClass} bg-black cursor-pointer`}
                                    onChange={(e) => {
                                        const id = parseInt(e.target.value);
                                        if (id) {
                                            addWeapon(id);
                                            e.target.value = "";
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled className="bg-black">SELECIONE UM ITEM...</option>
                                    {arsenalData
                                        .filter(item => !arsenal.includes(item.id))
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(item => (
                                            <option key={item.id} value={item.id} className="bg-black">
                                                [{item.id}] {item.name} ({item.classification})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Selected Items List */}
                            <div className="space-y-2">
                                {arsenal.map(id => {
                                    const item = arsenalData.find(a => a.id === id);
                                    if (!item) return null;
                                    return (
                                        <div key={id} className="flex items-center justify-between p-2 bg-tech-primary/5 border border-tech-primary/20 group">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-tech-primary uppercase tracking-tight">[{item.id}] {item.name}</span>
                                                <span className="text-[8px] text-tech-primary/40 uppercase">{item.classification} // {item.nature}</span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => removeWeapon(id)}
                                                className="p-1 text-red-500 hover:bg-red-500/20 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {arsenal.length === 0 && (
                                <div className="text-center py-4 border border-dashed border-tech-dim text-[9px] text-tech-dim uppercase">
                                    Nenhum equipamento vinculado.
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* ====== ABA GALERIA ====== */}
                    {activeSection === 'galeria' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-black bg-tech-primary p-1 pl-2 uppercase clip-corner-sm">Galeria</h3>

                        <div className="bg-tech-panel/40 border border-tech-border p-3 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-tech-primary uppercase block tracking-wider flex items-center gap-1">
                                    <Images size={12} /> Fotos de Era e Eventos
                                </label>
                                <button
                                    type="button"
                                    onClick={addGalleryImage}
                                    className="px-2 py-1 bg-tech-primary/10 border border-tech-primary text-tech-primary text-[8px] font-bold uppercase hover:bg-tech-primary hover:text-black transition-all"
                                >
                                    + Adicionar Imagem
                                </button>
                            </div>

                            {gallery.map((img, idx) => (
                                <div key={idx} className="p-3 border border-tech-border bg-black/40 space-y-3 relative">
                                    <button
                                        type="button"
                                        onClick={() => removeGalleryImage(idx)}
                                        className="absolute top-2 right-2 text-red-500 hover:text-red-400"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="text-[8px] text-tech-dim font-bold uppercase mb-2">Imagem #{idx + 1}</div>

                                    <div className={`grid grid-cols-1 gap-3 items-end ${img.category === 'evento' ? 'md:grid-cols-[1fr_auto_auto]' : 'md:grid-cols-[1fr_auto]'}`}>
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Legenda:</label>
                                            <input
                                                value={img.caption || ''}
                                                onChange={(e) => handleGalleryChange(idx, 'caption', e.target.value)}
                                                className={inputClass}
                                                placeholder="Ex: Nishinoya se sacrificando"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Categoria:</label>
                                            <select
                                                value={img.category}
                                                onChange={(e) => handleGalleryChange(idx, 'category', e.target.value)}
                                                className={inputClass}
                                            >
                                                <option value="era">Era</option>
                                                <option value="evento">Evento</option>
                                            </select>
                                        </div>
                                        {img.category === 'evento' && (
                                            <div>
                                                <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">Temporada:</label>
                                                <select
                                                    value={img.season || EVENT_SEASONS[0]}
                                                    onChange={(e) => handleGalleryChange(idx, 'season', e.target.value)}
                                                    className={inputClass}
                                                >
                                                    {EVENT_SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-tech-primary/60 uppercase block mb-0.5">URL da Imagem:</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={img.url}
                                                onChange={(e) => handleGalleryChange(idx, 'url', e.target.value)}
                                                className={inputClass}
                                                placeholder="URL da imagem (preencha a legenda antes de subir o arquivo, pra ele já nascer com nome certo)"
                                            />
                                            <ImageUploadButton
                                                pathPrefix={galleryPathPrefix(img)}
                                                fileName={img.caption?.trim() ? `${String(idx + 1).padStart(2, '0')} - ${img.caption.trim()}` : undefined}
                                                onUploaded={(url) => handleGalleryChange(idx, 'url', url)}
                                            />
                                        </div>
                                    </div>

                                    {img.url && (
                                        <img src={formatImageUrl(img.url)} alt={img.caption || ''} className="w-full max-h-40 object-cover border border-tech-border/50" />
                                    )}
                                </div>
                            ))}

                            {gallery.length === 0 && (
                                <div className="text-center py-4 border border-dashed border-tech-dim text-[9px] text-tech-dim uppercase">
                                    Nenhuma imagem na galeria.
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* ====== ABA FICHA ====== */}
                    {activeSection === 'ficha' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-black bg-tech-primary p-1 pl-2 uppercase clip-corner-sm">Atributos</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-bold text-red-400 uppercase block mb-1">HP</label><input name="hp" type="number" value={formData.hp} onChange={handleChange} className={`${inputClass} text-red-400 border-red-900/50`} /></div>
                            <div><label className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Chakra</label><input name="chakra" type="number" value={formData.chakra} onChange={handleChange} className={`${inputClass} text-blue-400 border-blue-900/50`} /></div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 bg-black/30 p-2 border border-tech-primary/20">
                            {statsConfig.map(stat => (
                                <div key={stat.key} className="col-span-2">
                                    <label className="text-[9px] font-bold text-tech-primary/60 uppercase block mb-1 text-center truncate">{stat.label}</label>
                                    <input name={stat.key} type="text" value={formData[stat.key as keyof FormData] as string | number} onChange={handleChange} className="w-full bg-[#0a0f0a] border border-tech-dim p-1 text-center text-tech-primary text-xs focus:border-tech-primary outline-none transition-colors" />
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 pt-4 border-t border-tech-primary/20">
                            <div><label className={labelClass}>Poderes (nome: nível)</label><textarea name="powers" placeholder="Katon: 5" value={formData.powers} onChange={handleChange} className={`${inputClass} h-20 font-mono text-tech-accent`} /></div>
                            <div><label className={labelClass}>Aptidões (CSV)</label><input name="aptitudes" placeholder="Intuição, Ponto Cego" value={formData.aptitudes} onChange={handleChange} className={inputClass} /></div>
                        </div>
                    </div>
                    )}

                    </div>

                    {/* Rodapé: navegação entre abas + salvar */}
                    <div className="p-4 border-t border-tech-border bg-black/40 flex items-center justify-between gap-3 flex-wrap shrink-0">
                        <div className="flex gap-2">
                            <button type="button" disabled={sectionIndex === 0} onClick={() => setActiveSection(sections[Math.max(0, sectionIndex - 1)].key)}
                                className="px-3 py-2 border border-tech-dim text-tech-primary/70 hover:text-tech-primary hover:border-tech-primary uppercase text-[10px] font-bold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronLeft size={14} /> Anterior
                            </button>
                            <button type="button" disabled={sectionIndex === sections.length - 1} onClick={() => setActiveSection(sections[Math.min(sections.length - 1, sectionIndex + 1)].key)}
                                className="px-3 py-2 border border-tech-dim text-tech-primary/70 hover:text-tech-primary hover:border-tech-primary uppercase text-[10px] font-bold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
                                Próximo <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            {formError && <span className="text-red-400 text-[10px] uppercase">{formError}</span>}
                            <button type="submit" className="px-6 py-2.5 bg-tech-primary hover:bg-white text-black font-black uppercase text-sm transition-colors flex items-center gap-2 clip-corner-sm"><Save size={16} /> {isEditing ? 'REVISAR EDIÇÃO' : 'GRAVAR DADOS'}</button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    </div>
  );
};

export default AddCharacterModal;
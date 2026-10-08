import React, { useState } from 'react';
import { X, Lock, LogIn, Loader } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<unknown>;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('E-mail ou senha incorretos.');
      } else if (code.includes('too-many-requests')) {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Não foi possível entrar. Verifique a conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[#050a05] border border-tech-primary/30 p-2 text-white text-sm focus:border-tech-primary focus:bg-black focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] outline-none transition-all placeholder:text-white/20";
  const labelClass = "text-[10px] font-bold text-tech-primary/80 uppercase block mb-1 tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-tech-bg border-2 border-tech-primary shadow-[0_0_40px_rgba(0,255,65,0.1)] flex flex-col clip-corner">
        <div className="p-3 bg-tech-primary/10 border-b border-tech-primary flex justify-between items-center">
          <h2 className="text-lg font-bold text-tech-primary flex items-center gap-2 uppercase tracking-widest">
            <Lock size={18} /> Acesso Admin
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-red-500 hover:text-black text-red-500 border border-transparent hover:border-red-500 transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              placeholder="admin@exemplo.com"
              autoFocus
              required
            />
          </div>
          <div>
            <label className={labelClass}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs border border-red-500/40 bg-red-500/10 p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-tech-primary text-black font-bold uppercase text-sm hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;

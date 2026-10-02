import React, { useEffect } from 'react';
import { CheckCircle2, CreditCard, ExternalLink, ShieldCheck, X } from 'lucide-react';

interface AccountPanelProps {
  email: string;
  plan: string;
  hasVerifiedAccess: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const formatPlan = (plan: string) => {
  if (plan === 'pro' || plan === 'paid') return 'CDLRadar Pro';
  return 'CDLRadar Free';
};

const AccountPanel: React.FC<AccountPanelProps> = ({ email, plan, hasVerifiedAccess, isOpen, onClose }) => {
  const isPro = plan === 'pro' || plan === 'paid';
  const accessLabel = hasVerifiedAccess ? 'Acceso confirmado' : 'Acceso limitado';

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <section className="w-full max-w-3xl overflow-hidden border border-white/10 bg-[#0b0f14] shadow-2xl md:rounded-xl" role="dialog" aria-modal="true" aria-labelledby="account-panel-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4 md:px-7 md:py-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400"><ShieldCheck className="h-4 w-4" /> Cuenta verificada</div>
            <h2 id="account-panel-title" className="text-xl font-bold text-white md:text-2xl">Tu cuenta CDLRadar</h2>
            <p className="mt-1 text-sm text-neutral-400">{email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white" aria-label="Cerrar panel de cuenta">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_.9fr] md:p-7">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Plan actual</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatPlan(plan)}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${hasVerifiedAccess ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${hasVerifiedAccess ? 'bg-emerald-400' : 'bg-amber-300'}`} /> {accessLabel}
              </span>
            </div>
            <p className="mt-4 border-t border-emerald-400/15 pt-4 text-sm leading-relaxed text-neutral-300">
              {isPro
                ? 'Tu plan Pro habilita el acceso completo al Radar, señales premium y alertas sin límite de tiempo.'
                : 'Estás utilizando el acceso gratuito disponible. Puedes pasar a Pro para desbloquear el Radar sin límites.'}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><CreditCard className="h-4 w-4 text-cyan-300" /> Pago y renovación</div>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {isPro ? 'La suscripción se reconoce como activa para esta cuenta.' : 'No hay una suscripción Pro activa asociada a esta cuenta.'}
            </p>
            <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100">
              Gestionar en PayPal <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 md:col-span-2">
            <h3 className="text-sm font-semibold text-white">Incluido en tu acceso</h3>
            <div className="mt-4 grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Escáner de mercado en tiempo real</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Gráficos y niveles de operación</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Alertas configurables en este dispositivo</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Historial de precisión publicado</span>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 text-xs text-neutral-500 md:flex-row md:items-center md:justify-between md:px-7">
          <span>El acceso se valida al abrir CDLRadar.</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Políticas de CDLRadar">
            <a href="/contacto/privacidad.html" target="_blank" rel="noreferrer" className="hover:text-white">Privacidad</a>
            <a href="/politica-cookies/" target="_blank" rel="noreferrer" className="hover:text-white">Cookies</a>
            <a href="/contacto/aviso-legal.html" target="_blank" rel="noreferrer" className="hover:text-white">Aviso legal</a>
          </nav>
        </footer>
      </section>
    </div>
  );
};

export default AccountPanel;
"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { Ship, Store, Eye } from 'lucide-react';
import { loginT } from '@/lib/loginTranslations';
import type { Language } from '@/lib/i18n';

export type UserRole = 'AGENT' | 'OWNER' | 'BUYER';

interface RoleOption {
  role: UserRole;
  icon: React.ElementType;
  labelKey: 'roleAgent' | 'roleOwner' | 'roleViewer';
  descKey: 'roleAgentDesc' | 'roleOwnerDesc' | 'roleViewerDesc';
  color: string;
  glow: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'AGENT',
    icon: Ship,
    labelKey: 'roleAgent',
    descKey: 'roleAgentDesc',
    color: 'text-ocean-400',
    glow: 'rgba(14, 165, 233, 0.25)',
  },
  {
    role: 'OWNER',
    icon: Store,
    labelKey: 'roleOwner',
    descKey: 'roleOwnerDesc',
    color: 'text-teal-400',
    glow: 'rgba(20, 184, 166, 0.25)',
  },
  {
    role: 'BUYER',
    icon: Eye,
    labelKey: 'roleViewer',
    descKey: 'roleViewerDesc',
    color: 'text-ocean-300',
    glow: 'rgba(125, 211, 252, 0.2)',
  },
];

interface RoleSelectModalProps {
  isOpen: boolean;
  lang: Language;
  userName: string;
  isLoading?: boolean;
  onSelect: (role: UserRole) => void;
}

export default function RoleSelectModal({
  isOpen,
  lang,
  userName,
  isLoading = false,
  onSelect,
}: RoleSelectModalProps) {
  const t = loginT[lang];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="role-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="w-full max-w-[400px] login-card p-8"
            aria-modal="true"
            role="dialog"
            aria-labelledby="role-modal-title"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-4xl"
                style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                🐟
              </div>
              <h2
                id="role-modal-title"
                className="text-xl font-black text-white mb-2"
              >
                {t.welcomeModal}
              </h2>
              {userName && (
                <p className="text-ocean-300 text-sm font-medium">
                  {t.welcomeUser.replace('[Name]', userName)}
                </p>
              )}
              <p className="text-ocean-400 text-sm mt-2">{t.selectRole}</p>
            </div>

            {/* Role Cards */}
            <div className="space-y-3">
              {ROLES.map(({ role, icon: Icon, labelKey, descKey, color, glow }) => (
                <button
                  key={role}
                  id={`role-btn-${role.toLowerCase()}`}
                  onClick={() => onSelect(role)}
                  disabled={isLoading}
                  className="role-card w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ '--glow': glow } as React.CSSProperties}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${glow}`, border: `1px solid ${glow}` }}
                  >
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${color}`}>
                      {t[labelKey]}
                    </p>
                    <p className="text-ocean-400 text-xs mt-0.5">
                      {t[descKey]}
                    </p>
                  </div>
                  {isLoading && (
                    <div className="ml-auto">
                      <div className="w-4 h-4 border-2 border-ocean-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

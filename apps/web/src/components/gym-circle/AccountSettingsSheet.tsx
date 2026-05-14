"use client";

import type { ReactNode } from "react";
import {
  ChevronRight,
  FileText,
  LogOut,
  Mail,
  PauseCircle,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type AccountSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  onDeleteAccount?: () => void;
  onSignOut?: () => void;
  onSuspendAccount?: () => void;
};

export function AccountSettingsSheet({
  open,
  onClose,
  onDeleteAccount,
  onSignOut,
  onSuspendAccount,
}: AccountSettingsSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/68 px-0 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Configurações da conta"
    >
      <button
        aria-label="Fechar configurações"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.08] bg-[#111113]/96 px-5 pb-[calc(var(--gc-safe-bottom)+18px)] pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[18px] font-black text-white">Configurações</p>
            <p className="mt-0.5 text-[12px] font-bold text-white/44">
              Conta, privacidade e suporte
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white/72"
            onClick={onClose}
            type="button"
          >
            <X size={19} strokeWidth={2.4} />
          </button>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
          <SettingsLink href="/privacy" icon={<ShieldCheck size={18} />}>
            Política de Privacidade
          </SettingsLink>
          <SettingsLink href="/terms" icon={<FileText size={18} />}>
            Termos de Uso
          </SettingsLink>
          <SettingsLink
            href="mailto:suporte@gymcircle.app?subject=Suporte%20Gym%20Circle"
            icon={<Mail size={18} />}
          >
            Suporte / Fale conosco
          </SettingsLink>
        </div>

        <div className="mt-3 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
          {onSignOut ? (
            <SettingsButton icon={<LogOut size={18} />} onClick={onSignOut}>
              Sair da conta
            </SettingsButton>
          ) : null}
          {onSuspendAccount ? (
            <SettingsButton icon={<PauseCircle size={18} />} onClick={onSuspendAccount}>
              Suspender conta temporariamente
            </SettingsButton>
          ) : null}
        </div>

        {onDeleteAccount ? (
          <div className="mt-3 overflow-hidden rounded-[24px] border border-[var(--gc-pink)]/16 bg-[var(--gc-pink)]/[0.07]">
            <SettingsButton
              destructive
              icon={<Trash2 size={18} />}
              onClick={onDeleteAccount}
            >
              Excluir conta
            </SettingsButton>
          </div>
        ) : null}

        <p className="mt-4 px-2 text-center text-[11px] font-bold leading-4 text-white/34">
          Suspender oculta seu perfil até a reativação por email. Excluir é permanente.
        </p>
      </div>
    </div>
  );
}

function SettingsLink({
  children,
  href,
  icon,
}: {
  children: string;
  href: string;
  icon: ReactNode;
}) {
  return (
    <a
      className="gc-pressable flex min-h-[56px] items-center gap-3 border-b border-white/[0.06] px-4 text-[14px] font-black text-white last:border-b-0"
      href={href}
    >
      <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-[var(--gc-brand)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight className="text-white/30" size={17} strokeWidth={2.4} />
    </a>
  );
}

function SettingsButton({
  children,
  destructive = false,
  icon,
  onClick,
}: {
  children: string;
  destructive?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "gc-pressable flex min-h-[56px] w-full items-center gap-3 border-b border-white/[0.06] px-4 text-left text-[14px] font-black last:border-b-0",
        destructive ? "text-[var(--gc-pink)]" : "text-white",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <span
        className={[
          "grid size-9 place-items-center rounded-full",
          destructive
            ? "bg-[var(--gc-pink)]/10 text-[var(--gc-pink)]"
            : "bg-white/[0.06] text-white/72",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight className="text-white/30" size={17} strokeWidth={2.4} />
    </button>
  );
}

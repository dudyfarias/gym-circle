"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Lock,
  LogOut,
  Mail,
  PauseCircle,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type SupportedLocale, useLocale } from "@/i18n";

type AccountSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  onDeleteAccount?: () => void;
  onSignOut?: () => void;
  onSuspendAccount?: () => void;
  /**
   * Sprint 4.5: toggle de conta privada. Estado atual vem de
   * `isPrivate`; ao clicar, parent decide se persiste no DB
   * (via updateProfile) e devolve via `isPrivate` updated.
   */
  isPrivate?: boolean;
  onTogglePrivate?: (next: boolean) => void | Promise<void>;
  /**
   * Sprint 4.5: toggle de push notifications. Estado vem do parent
   * (que lê de localStorage). `onTogglePush(next)` lida com
   * requestPermission (true) / revoke token (false).
   */
  pushEnabled?: boolean;
  onTogglePush?: (next: boolean) => void | Promise<void>;
};

export function AccountSettingsSheet({
  open,
  onClose,
  onDeleteAccount,
  onSignOut,
  onSuspendAccount,
  isPrivate,
  onTogglePrivate,
  pushEnabled,
  onTogglePush,
}: AccountSettingsSheetProps) {
  // Sprint 4.3: i18n + language picker.
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/68 px-0 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
    >
      <button
        aria-label={t("settings.openLabel")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.08] bg-[#111113]/96 px-5 pb-[calc(var(--gc-safe-bottom)+18px)] pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.65)] max-h-[88dvh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/18" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[18px] font-black text-white">
              {t("settings.title")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white/72"
            onClick={onClose}
            type="button"
          >
            <X size={19} strokeWidth={2.4} />
          </button>
        </div>

        {/* Idioma — Sprint 4.3 */}
        <LanguageSection />

        {/* Notificações — Sprint 4.5 */}
        {onTogglePush ? (
          <NotificationsSection
            enabled={pushEnabled ?? false}
            onToggle={onTogglePush}
          />
        ) : null}

        {/* Privacidade — Sprint 4.5 */}
        {onTogglePrivate ? (
          <PrivacySection
            isPrivate={isPrivate ?? false}
            onToggle={onTogglePrivate}
          />
        ) : null}

        {/* Sobre (links públicos) */}
        <div className="mt-3 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
          <SettingsLink href="/privacy" icon={<ShieldCheck size={18} />}>
            {t("settings.about.privacyPolicy")}
          </SettingsLink>
          <SettingsLink href="/terms" icon={<FileText size={18} />}>
            {t("settings.about.terms")}
          </SettingsLink>
          <SettingsLink
            href="mailto:suporte@gymcircle.app?subject=Suporte%20Gym%20Circle"
            icon={<Mail size={18} />}
          >
            {t("settings.about.support")}
          </SettingsLink>
        </div>

        {/* Conta — signout / suspend */}
        <div className="mt-3 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
          {onSignOut ? (
            <SettingsButton icon={<LogOut size={18} />} onClick={onSignOut}>
              {t("settings.account.signOut")}
            </SettingsButton>
          ) : null}
          {onSuspendAccount ? (
            <SettingsButton icon={<PauseCircle size={18} />} onClick={onSuspendAccount}>
              {t("settings.account.suspend")}
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
              {t("settings.account.delete")}
            </SettingsButton>
          </div>
        ) : null}

        <p className="mt-4 px-2 text-center text-[11px] font-bold leading-4 text-white/34">
          {t("settings.account.legalNote")}
        </p>
      </div>
    </div>
  );
}

/**
 * Sprint 4.3 — Language picker.
 *
 * Segmented control PT/EN. Tap em uma das opções dispara `setLocale` que
 * persiste em localStorage + atualiza i18next. Re-renderiza o app inteiro
 * porque `useTranslation` hooks subscrevem no `languageChanged` event.
 *
 * UX decision: NÃO mostro um Dialog/Picker separado. O segmented control
 * inline é mais leve, mais Apple-like, e dado que só temos 2 idiomas, não
 * justifica overhead de modal. Quando crescer pra 3+ idiomas (ES, FR...),
 * trocar pra um picker dropdown.
 */
function LanguageSection() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <div className="mb-3">
      <SectionHeader icon={<Globe size={16} />} title={t("settings.sections.language.title")} />
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
        <div className="flex gap-2 p-2" role="radiogroup" aria-label={t("settings.language.selectLabel")}>
          {SUPPORTED_LOCALES.map((option) => (
            <LanguageOption
              active={locale === option}
              key={option}
              label={t(`settings.language.options.${optionKey(option)}`)}
              onSelect={() => void setLocale(option)}
              value={option}
            />
          ))}
        </div>
        <p className="border-t border-white/[0.06] px-4 py-3 text-[12px] font-semibold text-white/44">
          {t("settings.sections.language.description")}
        </p>
      </div>
    </div>
  );
}

function optionKey(locale: SupportedLocale): string {
  // Mapeia o code BCP-47 pra key JSON (camelCase). "pt-BR" → "ptBR".
  // Necessário porque JSON keys com hífen ficam estranhas (`options."pt-BR"`).
  if (locale === "pt-BR") return "ptBR";
  return locale;
}

function LanguageOption({
  active,
  label,
  onSelect,
  value,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
  value: SupportedLocale;
}) {
  return (
    <button
      aria-checked={active}
      className={[
        "gc-pressable flex flex-1 items-center justify-center gap-1.5 rounded-[16px] px-3 py-2.5 text-[13px] font-black",
        active
          ? "bg-[var(--gc-brand)] text-black"
          : "bg-white/[0.04] text-white/72",
      ].join(" ")}
      onClick={onSelect}
      role="radio"
      type="button"
      value={value}
    >
      {active ? <Check size={14} strokeWidth={3} /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Sprint 4.5 — Push notifications toggle.
 *
 * Single switch row. `enabled` é controlado pelo parent (localStorage-backed
 * em GymCirclePreview). Tap dispara:
 *   - ON → PushNotificationsService.requestPushPermission → iOS permission
 *     prompt → token storage. Se user nega, parent reverte o toggle.
 *   - OFF → PushNotificationsService.unregisterPushToken → revoga token
 *     no backend e limpa localStorage.
 *
 * Estado `pending` (local) cobre o gap entre tap e a Promise resolver —
 * impede tap duplo e mostra opacity reduzida.
 */
function NotificationsSection({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    if (pending) return;
    setPending(true);
    try {
      await onToggle(!enabled);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-3">
      <SectionHeader
        icon={<Bell size={14} />}
        title={t("settings.sections.notifications.title")}
      />
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
        <ToggleRow
          checked={enabled}
          description={t("settings.sections.notifications.push.description")}
          loading={pending}
          loadingLabel={t("settings.sections.notifications.push.enabling")}
          onToggle={handleToggle}
          title={t("settings.sections.notifications.push.title")}
        />
      </div>
    </div>
  );
}

/**
 * Sprint 4.5 — Privacy toggle (conta privada).
 *
 * Wire direto pra `social.actions.updateProfile({ isPrivate })` via parent.
 * O backend já tem `profiles.is_private` column + RLS rules que respeitam
 * — quando ON, posts/stories só ficam visíveis pra approved followers.
 */
function PrivacySection({
  isPrivate,
  onToggle,
}: {
  isPrivate: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    if (pending) return;
    setPending(true);
    try {
      await onToggle(!isPrivate);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-3">
      <SectionHeader
        icon={<Lock size={14} />}
        title={t("settings.sections.privacy.title")}
      />
      <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
        <ToggleRow
          checked={isPrivate}
          description={t("settings.sections.privacy.privateAccount.description")}
          loading={pending}
          onToggle={handleToggle}
          title={t("settings.sections.privacy.privateAccount.title")}
        />
      </div>
    </div>
  );
}

/**
 * Sprint 4.5 — Toggle row reutilizável.
 *
 * iOS-style switch (não nativo — input ficaria fora do dark UI). Track
 * verde claro quando ON, cinza translúcido quando OFF. Knob slide via
 * translate-x transition 200ms.
 */
function ToggleRow({
  checked,
  description,
  loading = false,
  loadingLabel,
  onToggle,
  title,
}: {
  checked: boolean;
  description: string;
  loading?: boolean;
  loadingLabel?: string;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      aria-checked={checked}
      className={[
        "gc-pressable flex w-full items-start gap-3 px-4 py-4 text-left",
        loading ? "opacity-50" : "",
      ].join(" ")}
      disabled={loading}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black text-white">{title}</p>
        <p className="mt-1 text-[12px] font-semibold leading-4 text-white/52">
          {loading && loadingLabel ? loadingLabel : description}
        </p>
      </div>
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-[var(--gc-brand)]" : "bg-white/[0.12]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function SectionHeader({ icon, title }: { icon?: ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      {icon ? (
        <span className="grid size-6 place-items-center rounded-full bg-white/[0.06] text-white/56">
          {icon}
        </span>
      ) : null}
      <p className="text-[12px] font-black uppercase tracking-wider text-white/52">
        {title}
      </p>
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

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  emptyTrainerProfileDraft,
  loadLatestTrainerVerificationRequest,
  loadTrainerProfile,
  maskRegistrationNumber,
  saveTrainerProfile,
  TRAINER_SERVICE_MODES,
  TRAINER_SPECIALTIES,
  trainerProfileDraftFromRows,
  validateTrainerProfileDraft,
  type TrainerProfile,
  type TrainerProfileDraft,
} from "./trainerProfile";
import { TrainerVerificationBadge } from "./TrainerProfileSection";

type TrainerProfileFormProps = {
  open: boolean;
  userId: string;
  fallbackName: string;
  onClose: () => void;
  onSaved?: (profile: TrainerProfile) => void;
};

const STEPS = [
  "intro",
  "professional",
  "specialties",
  "service",
  "registration",
  "review",
] as const;

export function TrainerProfileForm({
  open,
  userId,
  fallbackName,
  onClose,
  onSaved,
}: TrainerProfileFormProps) {
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [draft, setDraft] = useState<TrainerProfileDraft>(() =>
    emptyTrainerProfileDraft(fallbackName),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setStep(0);
      setError(null);
      setLoading(true);
      void Promise.all([
        loadTrainerProfile(services.client, userId),
        loadLatestTrainerVerificationRequest(services.client, userId),
      ])
        .then(([nextProfile, request]) => {
          if (!active) return;
          setProfile(nextProfile);
          setDraft(
            trainerProfileDraftFromRows(
              nextProfile,
              request,
              fallbackName,
            ),
          );
        })
        .catch(() => {
          if (!active) return;
          setError(t("trainer.form.errors.load"));
          setDraft(emptyTrainerProfileDraft(fallbackName));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fallbackName, open, services.client, t, userId]);

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const isLastStep = step === STEPS.length - 1;

  const canContinue = useMemo(() => {
    if (currentStep === "professional") {
      return (
        draft.professionalName.trim().length >= 2 &&
        draft.headline.trim().length >= 3 &&
        draft.professionalBio.trim().length >= 20
      );
    }
    if (currentStep === "specialties") return draft.specialties.length > 0;
    if (currentStep === "registration") {
      return (
        Boolean(draft.registrationNumber.trim()) ===
        Boolean(draft.registrationRegion.trim())
      );
    }
    return true;
  }, [currentStep, draft]);

  if (!open) return null;

  function updateDraft(patch: Partial<TrainerProfileDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function nextStep() {
    if (!canContinue) {
      setError(t(`trainer.form.errors.${currentStep}`));
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function submit() {
    const validationError = validateTrainerProfileDraft(draft);
    if (validationError) {
      setError(t(`trainer.form.errors.${validationError}`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveTrainerProfile(services.client, userId, draft, {
        submitVerification: profile?.verification_status !== "verified",
      });
      setProfile(saved);
      onSaved?.(saved);
      onClose();
    } catch {
      setError(t("trainer.form.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-label={t("trainer.form.title")}
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/76 backdrop-blur-2xl"
      role="dialog"
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative flex max-h-[94dvh] min-h-[72dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[34px] border border-white/[0.09] bg-[#0d0f11] shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <header className="border-b border-white/[0.06] px-5 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <button
              aria-label={t("common.back")}
              className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white/72 disabled:opacity-30"
              disabled={step === 0 || loading || saving}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-[15px] font-black text-white">
                {profile
                  ? t("trainer.form.editTitle")
                  : t("trainer.form.title")}
              </p>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/36">
                {t("trainer.form.step", { current: step + 1, total: STEPS.length })}
              </p>
            </div>
            <button
              aria-label={t("common.close")}
              className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white/72"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
          {loading ? (
            <div className="grid min-h-[340px] place-items-center text-[var(--gc-brand)]">
              <LoaderCircle className="animate-spin" size={28} />
            </div>
          ) : (
            <>
              <TrainerStep
                draft={draft}
                profile={profile}
                step={currentStep}
                updateDraft={updateDraft}
              />
              {error ? (
                <p className="mt-4 rounded-[16px] border border-[var(--gc-pink)]/18 bg-[var(--gc-pink)]/[0.08] px-3 py-2.5 text-[12px] font-bold leading-4 text-[var(--gc-pink)]">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </main>

        {!loading ? (
          <footer className="border-t border-white/[0.06] bg-black/24 px-5 pb-[calc(var(--gc-safe-bottom)+14px)] pt-3">
            <button
              className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-45"
              disabled={!canContinue || saving}
              onClick={() => (isLastStep ? void submit() : nextStep())}
              type="button"
            >
              {saving ? <LoaderCircle className="animate-spin" size={17} /> : null}
              {isLastStep
                ? t("trainer.form.submit")
                : t("common.next")}
              {!isLastStep && !saving ? <ChevronRight size={17} /> : null}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function TrainerStep({
  draft,
  profile,
  step,
  updateDraft,
}: {
  draft: TrainerProfileDraft;
  profile: TrainerProfile | null;
  step: (typeof STEPS)[number];
  updateDraft: (patch: Partial<TrainerProfileDraft>) => void;
}) {
  const { t } = useTranslation();

  if (step === "intro") {
    return (
      <div className="pt-4 text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-[28px] border border-[var(--gc-brand)]/18 bg-[var(--gc-brand)]/10 text-[var(--gc-brand)] shadow-[0_20px_70px_rgba(48,213,255,0.12)]">
          <BriefcaseBusiness size={34} strokeWidth={2.2} />
        </div>
        <h2 className="mt-6 text-[24px] font-black leading-tight text-white">
          {t("trainer.form.intro.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-[360px] text-[14px] font-semibold leading-6 text-white/58">
          {t("trainer.form.intro.body")}
        </p>
        <div className="mt-6 rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-4 text-left">
          <p className="text-[12px] font-black text-white/82">
            {t("trainer.form.intro.noticeTitle")}
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-white/50">
            {t("trainer.form.intro.noticeBody")}
          </p>
        </div>
      </div>
    );
  }

  if (step === "professional") {
    return (
      <StepShell title={t("trainer.form.professional.title")}>
        <FormField label={t("trainer.form.fields.professionalName")}>
          <input
            className={inputClassName}
            maxLength={80}
            onChange={(event) => updateDraft({ professionalName: event.target.value })}
            value={draft.professionalName}
          />
        </FormField>
        <FormField label={t("trainer.form.fields.headline")}>
          <input
            className={inputClassName}
            maxLength={120}
            onChange={(event) => updateDraft({ headline: event.target.value })}
            placeholder={t("trainer.form.fields.headlinePlaceholder")}
            value={draft.headline}
          />
        </FormField>
        <FormField label={t("trainer.form.fields.professionalBio")}>
          <textarea
            className={`${inputClassName} min-h-32 resize-none py-3`}
            maxLength={1200}
            onChange={(event) => updateDraft({ professionalBio: event.target.value })}
            placeholder={t("trainer.form.fields.bioPlaceholder")}
            value={draft.professionalBio}
          />
        </FormField>
      </StepShell>
    );
  }

  if (step === "specialties") {
    return (
      <StepShell
        subtitle={t("trainer.form.specialties.subtitle")}
        title={t("trainer.form.specialties.title")}
      >
        <div className="flex flex-wrap gap-2">
          {TRAINER_SPECIALTIES.map((specialty) => {
            const selected = draft.specialties.includes(specialty);
            return (
              <button
                aria-pressed={selected}
                className={chipClassName(selected)}
                key={specialty}
                onClick={() => {
                  const next = selected
                    ? draft.specialties.filter((item) => item !== specialty)
                    : [...draft.specialties, specialty].slice(0, 5);
                  updateDraft({ specialties: next });
                }}
                type="button"
              >
                {selected ? <Check size={14} /> : null}
                {t(`trainer.specialties.${specialty}`)}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] font-bold text-white/36">
          {t("trainer.form.specialties.limit", { count: draft.specialties.length })}
        </p>
      </StepShell>
    );
  }

  if (step === "service") {
    return (
      <StepShell title={t("trainer.form.service.title")}>
        <div className="grid gap-2">
          {TRAINER_SERVICE_MODES.map((mode) => (
            <button
              aria-pressed={draft.serviceMode === mode}
              className={serviceModeClassName(draft.serviceMode === mode)}
              key={mode}
              onClick={() => updateDraft({ serviceMode: mode })}
              type="button"
            >
              <span>{t(`trainer.serviceModes.${mode}`)}</span>
              {draft.serviceMode === mode ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <FormField label={t("trainer.form.fields.city")}>
            <input
              className={inputClassName}
              maxLength={80}
              onChange={(event) => updateDraft({ city: event.target.value })}
              value={draft.city}
            />
          </FormField>
          <FormField label={t("trainer.form.fields.state")}>
            <input
              className={inputClassName}
              maxLength={40}
              onChange={(event) => updateDraft({ state: event.target.value })}
              value={draft.state}
            />
          </FormField>
        </div>
        <FormField label={t("trainer.form.fields.yearsExperience")}>
          <input
            className={inputClassName}
            inputMode="numeric"
            max={80}
            min={0}
            onChange={(event) => updateDraft({ yearsExperience: event.target.value })}
            type="number"
            value={draft.yearsExperience}
          />
        </FormField>
        <ToggleRow
          checked={draft.acceptsNewClients}
          label={t("trainer.form.fields.acceptsNewClients")}
          onChange={(value) => updateDraft({ acceptsNewClients: value })}
        />
      </StepShell>
    );
  }

  if (step === "registration") {
    const verified = profile?.verification_status === "verified";
    return (
      <StepShell
        subtitle={t("trainer.form.registration.subtitle")}
        title={t("trainer.form.registration.title")}
      >
        {verified ? (
          <div className="rounded-[20px] border border-emerald-300/16 bg-emerald-300/[0.07] p-4">
            <TrainerVerificationBadge status="verified" />
            <p className="mt-3 text-[13px] font-bold text-white/64">
              {t("trainer.form.registration.verifiedBody", {
                number: maskRegistrationNumber(draft.registrationNumber),
              })}
            </p>
          </div>
        ) : (
          <>
            <FormField label={t("trainer.form.fields.registrationNumber")}>
              <input
                autoCapitalize="characters"
                className={inputClassName}
                maxLength={80}
                onChange={(event) => updateDraft({ registrationNumber: event.target.value })}
                value={draft.registrationNumber}
              />
            </FormField>
            <FormField label={t("trainer.form.fields.registrationRegion")}>
              <input
                autoCapitalize="characters"
                className={inputClassName}
                maxLength={40}
                onChange={(event) => updateDraft({ registrationRegion: event.target.value })}
                placeholder={t("trainer.form.fields.registrationRegionPlaceholder")}
                value={draft.registrationRegion}
              />
            </FormField>
            <p className="rounded-[16px] border border-white/[0.06] bg-white/[0.035] px-3 py-2.5 text-[11px] font-semibold leading-4 text-white/44">
              {t("trainer.form.registration.privacy")}
            </p>
          </>
        )}
      </StepShell>
    );
  }

  return (
    <StepShell title={t("trainer.form.review.title")}>
      <div className="rounded-[22px] border border-[var(--gc-brand)]/14 bg-[var(--gc-brand)]/[0.06] p-4">
        <div className="flex items-center gap-2 text-[var(--gc-brand)]">
          <ShieldCheck size={18} />
          <p className="text-[12px] font-black uppercase tracking-[0.12em]">
            {t("trainer.badge")}
          </p>
        </div>
        <h3 className="mt-3 text-[19px] font-black text-white">
          {draft.professionalName}
        </h3>
        <p className="mt-1 text-[13px] font-bold text-white/64">{draft.headline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {draft.specialties.map((specialty) => (
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-black text-white/68" key={specialty}>
              {t(`trainer.specialties.${specialty}`)}
            </span>
          ))}
        </div>
      </div>
      <ToggleRow
        checked={draft.contactCtaEnabled}
        label={t("trainer.form.fields.contactCtaEnabled")}
        onChange={(value) => updateDraft({ contactCtaEnabled: value })}
      />
      <ToggleRow
        checked={draft.profileVisibility === "public"}
        label={t("trainer.form.fields.profilePublic")}
        onChange={(value) => updateDraft({ profileVisibility: value ? "public" : "private" })}
      />
      <p className="text-[11px] font-semibold leading-4 text-white/40">
        {t("trainer.form.review.notice")}
      </p>
    </StepShell>
  );
}

function StepShell({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-[22px] font-black leading-tight text-white">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-[13px] font-semibold leading-5 text-white/52">{subtitle}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white/42">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className="gc-pressable mb-3 flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-left text-[13px] font-black text-white/78"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span>{label}</span>
      <span className={`grid size-6 place-items-center rounded-full ${checked ? "bg-[var(--gc-brand)] text-black" : "bg-white/[0.08] text-transparent"}`}>
        <Check size={14} strokeWidth={3} />
      </span>
    </button>
  );
}

const inputClassName =
  "h-12 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.055] px-4 text-[14px] font-bold text-white outline-none transition focus:border-[var(--gc-brand)]/45 focus:bg-white/[0.075]";

function chipClassName(selected: boolean) {
  return [
    "gc-pressable inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-black",
    selected
      ? "border-[var(--gc-brand)]/34 bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
      : "border-white/[0.08] bg-white/[0.04] text-white/62",
  ].join(" ");
}

function serviceModeClassName(selected: boolean) {
  return [
    "gc-pressable flex h-12 w-full items-center justify-between rounded-[16px] border px-4 text-[13px] font-black",
    selected
      ? "border-[var(--gc-brand)]/36 bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]"
      : "border-white/[0.08] bg-white/[0.04] text-white/62",
  ].join(" ");
}

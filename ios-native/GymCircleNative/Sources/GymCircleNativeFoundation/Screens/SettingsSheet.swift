import SwiftUI

/// SettingsSheet — Sprint 20.2 (paridade da aba de configurações web).
///
/// Privacidade (is_private), idioma (segue o sistema — info), legal
/// (/privacy e /terms do site), suspender conta, apagar conta e sair.
public struct SettingsSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    // Sprint 22.2 — seletor de idioma do app (independente do iPhone).
    @ObservedObject private var localization = LocalizationStore.shared

    @Environment(\.dismiss) private var dismiss
    @State private var isPrivate: Bool
    @State private var confirmSuspend = false
    @State private var confirmDelete = false
    @State private var isWorking = false
    @State private var nativeFeedback: String?

    private static let privacyURL = URL(string: "https://gym-circle-rust.vercel.app/privacy")!
    private static let termsURL = URL(string: "https://gym-circle-rust.vercel.app/terms")!
    private static let supportURL = URL(string: "https://gym-circle-rust.vercel.app/support")!

    public init(model: GymCircleAppModel) {
        self.model = model
        _isPrivate = State(initialValue: model.profile?.isPrivate ?? false)
    }

    public var body: some View {
        NavigationStack {
            List {
                Section(Loc.privacy) {
                    Toggle(isOn: $isPrivate) {
                        VStack(alignment: .leading, spacing: 2) {
                            GCText(Loc.privateProfile, style: .body)
                            GCText(
                                Loc.privateProfileSubtitle,
                                style: .caption,
                                color: GymCircleTheme.ColorToken.secondaryText
                            )
                        }
                    }
                    .tint(GymCircleTheme.ColorToken.cyan)
                    .onChange(of: isPrivate) { newValue in
                        Task { await model.setPrivacy(isPrivate: newValue) }
                    }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section(Loc.language) {
                    Picker(
                        selection: Binding(
                            get: { localization.language },
                            set: { localization.set($0) }
                        )
                    ) {
                        Text(Loc.languageSystem).tag(AppLanguage.system)
                        Text(Loc.portuguese).tag(AppLanguage.pt)
                        Text(Loc.english).tag(AppLanguage.en)
                    } label: {
                        GCText(Loc.appLanguage, style: .body)
                    }
                    .pickerStyle(.menu)
                    .tint(GymCircleTheme.ColorToken.cyan)

                    GCText(
                        Loc.languagePickerHint,
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section(Loc.iphoneSection) {
                    Button {
                        Task { await enablePush() }
                    } label: {
                        settingsActionRow(
                            Loc.enableNotifications,
                            systemImage: "bell.badge",
                            subtitle: Loc.enableNotificationsSubtitle
                        )
                    }
                    Button {
                        Task { await enableHealth() }
                    } label: {
                        settingsActionRow(
                            Loc.connectAppleHealth,
                            systemImage: "heart.text.square",
                            subtitle: Loc.connectAppleHealthSubtitle
                        )
                    }
                    if let nativeFeedback {
                        GCText(nativeFeedback, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section(Loc.legal) {
                    Link(destination: Self.privacyURL) { settingsRow(Loc.privacyPolicy) }
                    Link(destination: Self.termsURL) { settingsRow(Loc.termsOfUse) }
                    Link(destination: Self.supportURL) { settingsRow(Loc.support) }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section(Loc.account) {
                    Button {
                        confirmSuspend = true
                    } label: {
                        GCText(Loc.suspendAccount, style: .body, color: GymCircleTheme.ColorToken.rarityLegendary)
                    }
                    Button {
                        confirmDelete = true
                    } label: {
                        GCText(Loc.deleteAccount, style: .body, color: GymCircleTheme.ColorToken.pink)
                    }
                    Button {
                        Task {
                            await model.signOut()
                            dismiss()
                        }
                    } label: {
                        GCText(Loc.signOut, style: .body)
                    }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)
            }
            .scrollContentBackground(.hidden)
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.settings)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.close) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
            .disabled(isWorking)
        }
        .preferredColorScheme(.dark)
        .confirmationDialog(
            Loc.suspendConfirm,
            isPresented: $confirmSuspend,
            titleVisibility: .visible
        ) {
            Button(Loc.suspendAccount, role: .destructive) {
                Task {
                    isWorking = true
                    await model.suspendAccount()
                    isWorking = false
                    dismiss()
                }
            }
            Button(Loc.cancel, role: .cancel) {}
        }
        .confirmationDialog(
            Loc.deleteAccountConfirm,
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button(Loc.deleteAccount, role: .destructive) {
                Task {
                    isWorking = true
                    await model.deleteAccount()
                    isWorking = false
                    dismiss()
                }
            }
            Button(Loc.cancel, role: .cancel) {}
        }
    }

    private func settingsRow(_ title: String) -> some View {
        HStack {
            GCText(title, style: .body)
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
        }
    }

    private func settingsActionRow(_ title: String, systemImage: String, subtitle: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                GCText(title, style: .body)
                GCText(subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
        }
    }

    private func enablePush() async {
        isWorking = true
        defer { isWorking = false }
        nativeFeedback = await model.enablePushNotifications()
            ? Loc.notifEnabledFeedback
            : (model.error ?? Loc.notifEnableFailed)
    }

    private func enableHealth() async {
        isWorking = true
        defer { isWorking = false }
        nativeFeedback = await model.requestHealthKitAccess()
            ? Loc.healthConnectedFeedback
            : (model.error ?? Loc.healthConnectFailed)
    }
}

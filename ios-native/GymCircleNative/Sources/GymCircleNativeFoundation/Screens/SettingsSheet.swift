import SwiftUI

/// SettingsSheet — Sprint 20.2 (paridade da aba de configurações web).
///
/// Privacidade (is_private), idioma (segue o sistema — info), legal
/// (/privacy e /terms do site), suspender conta, apagar conta e sair.
public struct SettingsSheet: View {
    @ObservedObject private var model: GymCircleAppModel

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
                Section("Privacidade") {
                    Toggle(isOn: $isPrivate) {
                        VStack(alignment: .leading, spacing: 2) {
                            GCText("Perfil privado", style: .body)
                            GCText(
                                "So quem voce aceitar ve seus posts.",
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

                Section("Idioma") {
                    HStack {
                        GCText("Idioma do app", style: .body)
                        Spacer()
                        GCText(
                            Locale.current.identifier.hasPrefix("pt") ? "Português" : "English",
                            style: .body,
                            color: GymCircleTheme.ColorToken.secondaryText
                        )
                    }
                    GCText(
                        "Segue o idioma do iPhone (Ajustes > Geral > Idioma).",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section("iPhone") {
                    Button {
                        Task { await enablePush() }
                    } label: {
                        settingsActionRow(
                            "Ativar notificações",
                            systemImage: "bell.badge",
                            subtitle: "Mensagens, curtidas e marcações quando o envio push estiver ativo."
                        )
                    }
                    Button {
                        Task { await enableHealth() }
                    } label: {
                        settingsActionRow(
                            "Conectar Apple Saúde",
                            systemImage: "heart.text.square",
                            subtitle: "Preparado para kcal, duração e treinos nos resumos futuros."
                        )
                    }
                    if let nativeFeedback {
                        GCText(nativeFeedback, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                    }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section("Legal") {
                    Link(destination: Self.privacyURL) { settingsRow("Política de Privacidade") }
                    Link(destination: Self.termsURL) { settingsRow("Termos de Uso") }
                    Link(destination: Self.supportURL) { settingsRow("Suporte") }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)

                Section("Conta") {
                    Button {
                        confirmSuspend = true
                    } label: {
                        GCText("Suspender conta", style: .body, color: GymCircleTheme.ColorToken.rarityLegendary)
                    }
                    Button {
                        confirmDelete = true
                    } label: {
                        GCText("Apagar conta", style: .body, color: GymCircleTheme.ColorToken.pink)
                    }
                    Button {
                        Task {
                            await model.signOut()
                            dismiss()
                        }
                    } label: {
                        GCText("Sair", style: .body)
                    }
                }
                .listRowBackground(GymCircleTheme.ColorToken.card)
            }
            .scrollContentBackground(.hidden)
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Configurações")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
            }
            .disabled(isWorking)
        }
        .preferredColorScheme(.dark)
        .confirmationDialog(
            "Suspender sua conta? Seu perfil some até você reativar pelo link enviado por e-mail.",
            isPresented: $confirmSuspend,
            titleVisibility: .visible
        ) {
            Button("Suspender conta", role: .destructive) {
                Task {
                    isWorking = true
                    await model.suspendAccount()
                    isWorking = false
                    dismiss()
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .confirmationDialog(
            "Apagar sua conta? A exclusão é definitiva após o período de carência.",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Apagar conta", role: .destructive) {
                Task {
                    isWorking = true
                    await model.deleteAccount()
                    isWorking = false
                    dismiss()
                }
            }
            Button("Cancelar", role: .cancel) {}
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
            ? "Notificações ativadas neste iPhone."
            : (model.error ?? "Não foi possível ativar notificações.")
    }

    private func enableHealth() async {
        isWorking = true
        defer { isWorking = false }
        nativeFeedback = await model.requestHealthKitAccess()
            ? "Apple Saúde conectado para leitura de treinos."
            : (model.error ?? "Não foi possível conectar o Apple Saúde.")
    }
}

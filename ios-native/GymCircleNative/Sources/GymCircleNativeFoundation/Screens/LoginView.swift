import SwiftUI

public struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    private let error: String?
    private let onSignIn: (String, String) async throws -> Void

    public init(error: String? = nil, onSignIn: @escaping (String, String) async throws -> Void) {
        self.error = error
        self.onSignIn = onSignIn
    }

    public var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                GCText("Gym Circle", style: .title)
                GCText("Train together", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            GCCard {
                VStack(spacing: 12) {
                    TextField("email", text: $email)
                        .emailInputBehavior()
                        .formField()

                    SecureField("senha", text: $password)
                        .passwordInputBehavior()
                        .formField()

                    if let message = localError ?? error {
                        GCText(message, style: .caption, color: Color.red.opacity(0.9))
                    }

                    GCButton(isSubmitting ? "Entrando..." : "Entrar") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting)
                }
            }

            Spacer()
        }
        .padding(24)
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
    }

    private func submit() async {
        isSubmitting = true
        localError = nil
        defer { isSubmitting = false }

        do {
            try await onSignIn(email, password)
        } catch {
            self.localError = "Nao foi possivel entrar. Confira email e senha."
        }
    }
}

private extension View {
    @ViewBuilder
    func emailInputBehavior() -> some View {
        #if os(iOS)
        self
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .keyboardType(.emailAddress)
        #else
        self
        #endif
    }

    @ViewBuilder
    func passwordInputBehavior() -> some View {
        #if os(iOS)
        self.textContentType(.password)
        #else
        self
        #endif
    }

    func formField() -> some View {
        self
            .font(.system(size: 15, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(Color.black.opacity(0.42))
            .clipShape(Capsule())
            .overlay {
                Capsule().stroke(Color.white.opacity(0.08), lineWidth: 1)
            }
    }
}

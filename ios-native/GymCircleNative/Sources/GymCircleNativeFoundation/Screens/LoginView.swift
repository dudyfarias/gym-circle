import SwiftUI

public struct LoginView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var error: String?

    private let onSignIn: (String, String) async throws -> Void

    public init(onSignIn: @escaping (String, String) async throws -> Void) {
        self.onSignIn = onSignIn
    }

    public var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                GCText("Gym Circle", style: .title) // nome do produto (não traduz)
                GCText(L10n.loginTagline.string, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }

            GCCard {
                VStack(spacing: 12) {
                    TextField("email", text: $email)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .formField()

                    SecureField("senha", text: $password)
                        .textContentType(.password)
                        .formField()

                    if let error {
                        GCText(error, style: .caption, color: Color.red.opacity(0.9))
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
        error = nil
        defer { isSubmitting = false }

        do {
            try await onSignIn(email, password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private extension View {
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

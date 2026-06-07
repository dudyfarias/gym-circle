import SwiftUI

/// EditProfileSheet — Sprint 8.13.7 (paridade EditProfileSheet.tsx web).
///
/// Form com campos editáveis do perfil:
///   - Avatar (preview, picker pendente Sprint 9 — depende
///     UIImagePickerController + storage upload)
///   - Display name (TextField)
///   - Bio (TextEditor multi-line, 240 char limit)
///   - Fitness goal (TextField opcional)
///   - Toggle "Conta privada"
///
/// Save dispara ProfilesService.updateProfile + callback onSave(success).
/// onClose dismiss sem persistir.
public struct EditProfileSheet: View {
    public let profile: UserProfile
    public let onSave: (UserProfile) async -> Void
    public let onClose: () -> Void

    @State private var displayName: String
    @State private var bio: String
    @State private var fitnessGoal: String
    @State private var isPrivate: Bool
    @State private var isSaving = false
    @State private var saveError: String?

    private let bioCharLimit = 240

    public init(
        profile: UserProfile,
        onSave: @escaping (UserProfile) async -> Void,
        onClose: @escaping () -> Void
    ) {
        self.profile = profile
        self.onSave = onSave
        self.onClose = onClose
        _displayName = State(initialValue: profile.displayName ?? "")
        _bio = State(initialValue: profile.bio ?? "")
        _fitnessGoal = State(initialValue: profile.fitnessGoal ?? "")
        _isPrivate = State(initialValue: profile.isPrivate)
    }

    public var body: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Divider().background(Color.white.opacity(0.06))

                ScrollView {
                    VStack(spacing: 24) {
                        avatarSection
                        fieldsSection
                        privacyToggle
                        if let error = saveError {
                            Text(error)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.red.opacity(0.82))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 12)
                        }
                        Spacer(minLength: 24)
                    }
                    .padding(20)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Text(L10n.editProfileCancel.string)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.72))
            }
            .buttonStyle(.plain)
            Spacer()
            Text(L10n.editProfileTitle.string)
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
            Spacer()
            Button(action: { Task { await handleSave() } }) {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.7)
                } else {
                    Text(L10n.editProfileSave.string)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(canSave ? GymCircleTheme.ColorToken.electricBlue : .white.opacity(0.32))
                }
            }
            .buttonStyle(.plain)
            .disabled(!canSave || isSaving)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: 10) {
            GCAvatar(url: profile.avatarURL, fallback: profile.username, size: 96)
            Text(L10n.editProfileChangeAvatarSoon.string)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white.opacity(0.42))
        }
    }

    // MARK: - Fields

    private var fieldsSection: some View {
        VStack(spacing: 14) {
            fieldRow(label: L10n.editProfileDisplayName.string) {
                TextField("", text: $displayName)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 14, weight: .semibold))
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            }

            fieldRow(label: L10n.editProfileFitnessGoal.string) {
                TextField("", text: $fitnessGoal)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 14, weight: .semibold))
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(L10n.editProfileBio.string.uppercased())
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.44))
                    Spacer()
                    Text("\(bio.count)/\(bioCharLimit)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(bio.count > bioCharLimit ? .red.opacity(0.8) : .white.opacity(0.42))
                }
                TextEditor(text: $bio)
                    .foregroundColor(.white)
                    .font(.system(size: 14, weight: .semibold))
                    .scrollContentBackground(.hidden)
                    .background(Color.clear)
                    .padding(8)
                    .frame(minHeight: 92, alignment: .topLeading)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            }
        }
    }

    private func fieldRow<Content: View>(label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .foregroundColor(.white.opacity(0.44))
            content()
        }
    }

    // MARK: - Privacy toggle

    private var privacyToggle: some View {
        HStack(spacing: 12) {
            Image(systemName: isPrivate ? "lock.fill" : "lock.open.fill")
                .font(.system(size: 16, weight: .heavy))
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.white.opacity(0.06)))
                .foregroundColor(isPrivate ? GymCircleTheme.ColorToken.electricBlue : .white.opacity(0.62))

            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.editProfilePrivateToggle.string)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.white)
                Text(L10n.editProfilePrivateHint.string)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.52))
            }
            Spacer()
            Toggle("", isOn: $isPrivate)
                .labelsHidden()
                .tint(GymCircleTheme.ColorToken.electricBlue)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.04)))
    }

    // MARK: - Save

    private var canSave: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty
            && bio.count <= bioCharLimit
    }

    private func handleSave() async {
        guard canSave else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        let updated = UserProfile(
            id: profile.id,
            userId: profile.userId,
            username: profile.username,
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            avatarURL: profile.avatarURL,
            bio: bio.trimmingCharacters(in: .whitespaces),
            fitnessGoal: fitnessGoal.trimmingCharacters(in: .whitespaces),
            isPrivate: isPrivate,
            currentStreak: profile.currentStreak,
            bestStreak: profile.bestStreak,
            badgeIsActiveToday: profile.badgeIsActiveToday,
            featuredAchievements: profile.featuredAchievements,
            createdAt: profile.createdAt
        )
        await onSave(updated)
    }
}

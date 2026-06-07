import SwiftUI
import PhotosUI

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
    /// Sprint 9.2 — quando informado, EditProfileSheet faz upload via
    /// caller (`Data → URL`). Tipicamente injetado pelo NativeEditProfileHost
    /// que tem acesso ao ProfilesService.uploadAvatar.
    public let onUploadAvatar: ((Data) async -> String?)?
    public let onClose: () -> Void

    @State private var displayName: String
    @State private var bio: String
    @State private var fitnessGoal: String
    @State private var isPrivate: Bool
    @State private var isSaving = false
    @State private var saveError: String?

    // Sprint 9.2 — PhotosPicker state
    @State private var photoItem: PhotosPickerItem?
    @State private var pickedAvatarData: Data?
    @State private var uploadedAvatarURL: String?
    @State private var isUploadingAvatar = false

    private let bioCharLimit = 240

    public init(
        profile: UserProfile,
        onSave: @escaping (UserProfile) async -> Void,
        onUploadAvatar: ((Data) async -> String?)? = nil,
        onClose: @escaping () -> Void
    ) {
        self.profile = profile
        self.onSave = onSave
        self.onUploadAvatar = onUploadAvatar
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

    // MARK: - Avatar (Sprint 9.2 — PhotosPicker + upload)

    @ViewBuilder
    private var avatarSection: some View {
        VStack(spacing: 10) {
            avatarPreview
            if onUploadAvatar != nil {
                PhotosPicker(
                    selection: $photoItem,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Text(L10n.editProfileChangeAvatar.string)
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                }
                .onChange(of: photoItem) { newItem in
                    Task { await loadPickedPhoto(newItem) }
                }
                if isUploadingAvatar {
                    HStack(spacing: 6) {
                        ProgressView().scaleEffect(0.6).tint(.white)
                        Text(L10n.editProfileUploadingAvatar.string)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.62))
                    }
                }
            } else {
                Text(L10n.editProfileChangeAvatarSoon.string)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
            }
        }
    }

    @ViewBuilder
    private var avatarPreview: some View {
        // Preview prioritiza: pickedData → uploadedURL → profile.avatarURL
        if let data = pickedAvatarData, let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
                .frame(width: 96, height: 96)
                .clipShape(Circle())
                .overlay(Circle().stroke(Color.white.opacity(0.12), lineWidth: 1))
        } else {
            GCAvatar(url: uploadedAvatarURL ?? profile.avatarURL, fallback: profile.username, size: 96)
        }
    }

    private func loadPickedPhoto(_ item: PhotosPickerItem?) async {
        guard let item, let onUploadAvatar else { return }
        saveError = nil
        do {
            if let data = try await item.loadTransferable(type: Data.self) {
                pickedAvatarData = data
                isUploadingAvatar = true
                defer { isUploadingAvatar = false }
                let resized = downsampleToJPEG(data: data, maxDimension: 512, quality: 0.85) ?? data
                if let newURL = await onUploadAvatar(resized) {
                    uploadedAvatarURL = newURL
                } else {
                    saveError = L10n.editProfileUploadAvatarFailed.string
                }
            }
        } catch {
            saveError = error.localizedDescription
        }
    }

    /// Sprint 9.2 — downsample pra evitar uploads >5MB. Avatars público
    /// 512x512 atende para retina display 256pt físico.
    private func downsampleToJPEG(data: Data, maxDimension: CGFloat, quality: CGFloat) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let size = image.size
        let largestSide = max(size.width, size.height)
        let scale = min(1, maxDimension / largestSide)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        return resized.jpegData(compressionQuality: quality)
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

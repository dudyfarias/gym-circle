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
    public let onUploadAvatar: ((Data) async -> String?)?
    public let onClose: () -> Void

    @State private var displayName: String
    @State private var username: String
    @State private var bio: String
    @State private var fitnessGoal: String
    @State private var instagram: String
    @State private var sportsText: String
    @State private var birthDate: Date
    @State private var hasBirthDate: Bool
    @State private var preferredTimes: Set<String>
    @State private var isPrivate: Bool
    @State private var isSaving = false
    @State private var saveError: String?

    @State private var photoItem: PhotosPickerItem?
    @State private var pickedAvatarData: Data?
    @State private var uploadedAvatarURL: String?
    @State private var isUploadingAvatar = false

    // Sprint 9.7.1 — paridade web maxLengths
    private let displayNameLimit = 60
    private let usernameLimit = 32
    private let bioCharLimit = 200    // era 240 antes; web é 200
    private let goalLimit = 60
    private let instagramLimit = 30
    private let sportsLimit = 140

    // Sprint 9.7.1 — 5 time slots (paridade web TIME_ID_TO_KEY)
    static let timeSlots: [(id: String, labelEN: String, labelPT: String)] = [
        ("morning",    "Morning",    "Manhã"),
        ("lunch",      "Lunch",      "Almoço"),
        ("afternoon",  "Afternoon",  "Tarde"),
        ("evening",    "Evening",    "Noite"),
        ("late_night", "Late night", "Madrugada")
    ]

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
        _username = State(initialValue: profile.username)
        _bio = State(initialValue: profile.bio ?? "")
        _fitnessGoal = State(initialValue: profile.fitnessGoal ?? "")
        _instagram = State(initialValue: profile.instagramUsername ?? "")
        _sportsText = State(initialValue: profile.sports.joined(separator: ", "))
        _birthDate = State(initialValue: profile.birthDate ?? Calendar.current.date(byAdding: .year, value: -25, to: Date()) ?? Date())
        _hasBirthDate = State(initialValue: profile.birthDate != nil)
        _preferredTimes = State(initialValue: Set(profile.preferredTrainingTimes))
        _isPrivate = State(initialValue: profile.isPrivate)
    }

    public var body: some View {
        accessibleBody
            .accessibilityAddTraits(.isModal) // Sprint 9.8.5
            .onAppear {
                // Sprint 9.9.2 — reset error/upload state quando reabre
                // (paridade web useEffect(open) reset).
                saveError = nil
                isUploadingAvatar = false
            }
    }

    private var accessibleBody: some View {
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
            // Sprint 9.8.6 — avatar com camera badge integrado (paridade web)
            avatarPreview
            if isUploadingAvatar {
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.6).tint(.white)
                    Text(L10n.editProfileUploadingAvatar.string)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white.opacity(0.62))
                }
            } else if onUploadAvatar == nil {
                Text(L10n.editProfileChangeAvatarSoon.string)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
            }
        }
    }

    @ViewBuilder
    private var avatarPreview: some View {
        // Sprint 9.8.6 — wrapping ZStack pra adicionar camera badge bottom-right
        ZStack(alignment: .bottomTrailing) {
            avatarImage
            if onUploadAvatar != nil {
                // Camera badge brand glow (paridade web 44pt brand bg)
                PhotosPicker(
                    selection: $photoItem,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 14, weight: .heavy))
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(GymCircleTheme.ColorToken.electricBlue)
                                .shadow(color: GymCircleTheme.ColorToken.electricBlue.opacity(0.5), radius: 8)
                        )
                        .foregroundColor(.black)
                }
                .onChange(of: photoItem) { newItem in
                    Task { await loadPickedPhoto(newItem) }
                }
                .offset(x: 4, y: 4)
                .accessibilityLabel(Text(L10n.editProfileChangeAvatar.string))
            }
        }
    }

    @ViewBuilder
    private var avatarImage: some View {
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
            // Sprint 9.9.2 — fallback localizado quando description vem vazia
            // (alguns erros NSError trazem string vazia ou em inglês cru).
            let desc = error.localizedDescription.trimmingCharacters(in: .whitespaces)
            saveError = desc.isEmpty ? L10n.editProfileGenericError.string : desc
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
                styledTextField(text: $displayName, limit: displayNameLimit)
            }

            // Sprint 9.7.1 — Username com validation regex inline
            usernameField

            fieldRow(label: L10n.editProfileFitnessGoal.string) {
                styledTextField(text: $fitnessGoal, limit: goalLimit)
            }

            // Sprint 9.7.1 — Instagram com @ prefix
            fieldRow(label: L10n.editProfileInstagram.string) {
                HStack(spacing: 0) {
                    Text("@")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(.white.opacity(0.42))
                        .padding(.leading, 12)
                    TextField("", text: $instagram)
                        .textFieldStyle(.plain)
                        .foregroundColor(.white)
                        .font(.system(size: 14, weight: .semibold))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.vertical, 12)
                        .padding(.trailing, 12)
                        .onChange(of: instagram) { newValue in
                            // normalize: strip @, lowercase, truncate
                            var cleaned = newValue.lowercased().replacingOccurrences(of: "@", with: "")
                            if cleaned.count > instagramLimit {
                                cleaned = String(cleaned.prefix(instagramLimit))
                            }
                            if cleaned != newValue { instagram = cleaned }
                        }
                }
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
            }

            // Sprint 9.7.1 — Sports CSV
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(L10n.editProfileSports.string.uppercased())
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.6)
                        .foregroundColor(.white.opacity(0.44))
                    Spacer()
                    Text(L10n.editProfileSportsHint.string)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white.opacity(0.42))
                }
                styledTextField(text: $sportsText, limit: sportsLimit)
            }

            // Sprint 9.7.1 — Birth date com Toggle + DatePicker
            birthDateField

            // Sprint 9.7.1 — Preferred times chips multi-select
            preferredTimesField

            // Bio
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
                    // Sprint 9.9.2 — enforce limit pra consistência com outros campos
                    // (displayName/fitnessGoal/sports já enforçam via styledTextField).
                    .onChange(of: bio) { newValue in
                        if newValue.count > bioCharLimit {
                            bio = String(newValue.prefix(bioCharLimit))
                        }
                    }
            }
        }
    }

    // Sprint 9.7.1 + 9.9.2 — username com validation inline + mensagem específica
    private var usernameField: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(L10n.editProfileUsername.string.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundColor(.white.opacity(0.44))
                Spacer()
                Text("\(username.count)/\(usernameLimit)")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundColor(.white.opacity(0.42))
            }
            HStack(spacing: 0) {
                Text("@")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.white.opacity(0.42))
                    .padding(.leading, 12)
                TextField("", text: $username)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 14, weight: .semibold))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.vertical, 12)
                    .padding(.trailing, 12)
                    .onChange(of: username) { newValue in
                        // sanitize a-z0-9_.
                        var cleaned = newValue.lowercased()
                            .replacingOccurrences(of: " ", with: "")
                        cleaned.removeAll { ch in
                            !(ch.isLetter || ch.isNumber || ch == "_" || ch == ".")
                        }
                        if cleaned.count > usernameLimit {
                            cleaned = String(cleaned.prefix(usernameLimit))
                        }
                        if cleaned != newValue { username = cleaned }
                    }
            }
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isUsernameValid ? Color.white.opacity(0.08) : Color(red: 1.0, green: 0.42, blue: 0.42).opacity(0.4), lineWidth: 1)
            )
            // Sprint 9.9.2 — mensagem específica de validation
            Text(usernameValidationMessage)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(isUsernameValid ? .white.opacity(0.42) : Color(red: 1.0, green: 0.42, blue: 0.42))
                .padding(.top, 2)
        }
    }

    /// Sprint 9.9.2 — mensagem específica conforme estado da validation.
    private var usernameValidationMessage: String {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return L10n.editProfileUsernameHint.string
        }
        if trimmed.count < 3 {
            return L10n.editProfileUsernameTooShort.string
        }
        if !isUsernameValid {
            return L10n.editProfileUsernameInvalidChars.string
        }
        return L10n.editProfileUsernameHint.string
    }

    private var birthDateField: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(L10n.editProfileBirthDate.string.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundColor(.white.opacity(0.44))
                Spacer()
                Toggle("", isOn: $hasBirthDate)
                    .labelsHidden()
                    .tint(GymCircleTheme.ColorToken.electricBlue)
                    .scaleEffect(0.8)
            }
            if hasBirthDate {
                DatePicker(
                    "",
                    selection: $birthDate,
                    in: ...Date(),
                    displayedComponents: [.date]
                )
                .datePickerStyle(.compact)
                .labelsHidden()
                .colorScheme(.dark)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
            } else {
                // Sprint 9.9.2 — placeholder "Não definido" quando toggle off
                // (paridade web: campo vazio com hint visual).
                Text(L10n.editProfileBirthDateNone.string)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white.opacity(0.42))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.02)))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
            }
        }
    }

    private var preferredTimesField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L10n.editProfilePreferredTimes.string.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.6)
                .foregroundColor(.white.opacity(0.44))
            FlowChipsLayout {
                ForEach(Self.timeSlots, id: \.id) { slot in
                    timeChip(id: slot.id, label: localizedTimeLabel(slot))
                }
            }
        }
    }

    private func localizedTimeLabel(_ slot: (id: String, labelEN: String, labelPT: String)) -> String {
        let isEN = Locale.current.language.languageCode?.identifier.hasPrefix("en") ?? false
        return isEN ? slot.labelEN : slot.labelPT
    }

    private func timeChip(id: String, label: String) -> some View {
        let isActive = preferredTimes.contains(id)
        return Button(action: {
            Haptics.selection()
            if isActive { preferredTimes.remove(id) } else { preferredTimes.insert(id) }
        }) {
            Text(label)
                .font(.system(size: 12, weight: .heavy))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    Capsule().fill(isActive ? GymCircleTheme.ColorToken.electricBlue.opacity(0.16) : Color.white.opacity(0.05))
                )
                .foregroundColor(isActive ? GymCircleTheme.ColorToken.electricBlue : .white.opacity(0.62))
                .overlay(
                    Capsule().stroke(isActive ? GymCircleTheme.ColorToken.electricBlue.opacity(0.32) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }

    private func styledTextField(text: Binding<String>, limit: Int) -> some View {
        TextField("", text: text)
            .textFieldStyle(.plain)
            .foregroundColor(.white)
            .font(.system(size: 14, weight: .semibold))
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.04)))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .onChange(of: text.wrappedValue) { newValue in
                if newValue.count > limit {
                    text.wrappedValue = String(newValue.prefix(limit))
                }
            }
    }

    // Sprint 9.7.1 — username regex check
    private var isUsernameValid: Bool {
        let trimmed = username.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 3, trimmed.count <= usernameLimit else { return false }
        let regex = try? NSRegularExpression(pattern: "^[a-z0-9_.]+$")
        return regex?.firstMatch(in: trimmed, range: NSRange(location: 0, length: trimmed.utf16.count)) != nil
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
            && isUsernameValid // Sprint 9.7.1
    }

    private func handleSave() async {
        guard canSave else {
            Haptics.error() // Sprint 9.6.2
            return
        }
        Haptics.impactLight()
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        // Sprint 9.7.1 — sports parse CSV → trimmed array
        let sportsArr = sportsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let updated = UserProfile(
            id: profile.id,
            userId: profile.userId,
            username: username.trimmingCharacters(in: .whitespaces),
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            avatarURL: profile.avatarURL,
            bio: bio.trimmingCharacters(in: .whitespaces),
            fitnessGoal: fitnessGoal.trimmingCharacters(in: .whitespaces),
            isPrivate: isPrivate,
            currentStreak: profile.currentStreak,
            bestStreak: profile.bestStreak,
            badgeIsActiveToday: profile.badgeIsActiveToday,
            featuredAchievements: profile.featuredAchievements,
            createdAt: profile.createdAt,
            instagramUsername: instagram.isEmpty ? nil : instagram,
            birthDate: hasBirthDate ? birthDate : nil,
            sports: sportsArr,
            preferredTrainingTimes: Array(preferredTimes)
        )
        await onSave(updated)
        // Sprint 9.9.2 — haptic confirma pipeline rodou (callback é fire-and-forget,
        // erro real fica visível via saveError quando bridge JS propaga).
        Haptics.success()
    }
}

/// Sprint 9.7.1 — Flow layout simples pra chips multi-select.
/// Quebra linha quando largura excede o disponível.
private struct FlowChipsLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let spacing: CGFloat = 8
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth + size.width > maxWidth && rowWidth > 0 {
                totalHeight += rowHeight + spacing
                maxRowWidth = max(maxRowWidth, rowWidth - spacing)
                rowWidth = 0
                rowHeight = 0
            }
            rowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        maxRowWidth = max(maxRowWidth, rowWidth - spacing)
        return CGSize(width: maxRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        let spacing: CGFloat = 8
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            _ = maxWidth
        }
    }
}

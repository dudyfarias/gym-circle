import SwiftUI

/// RecapCoverPickerSheet — Sprint 8.13.5 (paridade Sprint 5.5 web).
///
/// Sheet bottom 82dvh com grid 3-col de posts do mês alvo. User tap em
/// foto → highlight + botão "Usar como capa" persiste via
/// `ProfilesService.setMonthlyRecapCover`. Callback `onSelect(postId)`
/// notifica o caller pra refresh do MonthlyRecapSheet com nova capa.
///
/// Quando não há posts no mês, mostra empty state.
public struct RecapCoverPickerSheet: View {
    public let posts: [MonthCalendarPost]
    public let currentCoverId: String?
    public let monthLabel: String
    /// Sprint 9.7.5 — callback agora aceita nil pra "auto-pick" (reset
    /// override). Web tem essa feature (`onSelect(null)`).
    public let onSelect: (String?) async -> Bool
    public let onClose: () -> Void

    @State private var selectedPostId: String?
    // Sprint 9.7.5 — feedback inline durante persistência
    @State private var savingPostId: String?
    @State private var savingAuto: Bool = false
    @State private var saveError: String?

    public init(
        posts: [MonthCalendarPost],
        currentCoverId: String? = nil,
        monthLabel: String,
        onSelect: @escaping (String?) async -> Bool,
        onClose: @escaping () -> Void
    ) {
        self.posts = posts
        self.currentCoverId = currentCoverId
        self.monthLabel = monthLabel
        self.onSelect = onSelect
        self.onClose = onClose
        _selectedPostId = State(initialValue: currentCoverId)
    }

    public var body: some View {
        ZStack(alignment: .top) {
            GymCircleTheme.ColorToken.appBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Divider().background(Color.white.opacity(0.06))

                ScrollView {
                    VStack(spacing: 14) {
                        // Sprint 9.7.5 — botão "auto" sempre visível (paridade web)
                        autoButton
                        if let err = saveError {
                            errorPill(err)
                        }
                        if posts.isEmpty {
                            emptyState
                        } else {
                            photosGrid
                        }
                    }
                    .padding(20)
                }

                if let pid = selectedPostId, savingAuto == false {
                    confirmBar(postId: pid)
                }
            }
        }
    }

    // MARK: - Auto / Error pill

    /// Sprint 9.7.5 — "Usar foto automática" (reset override).
    private var autoButton: some View {
        Button(action: { Task { await persist(nil) } }) {
            HStack(spacing: 8) {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 13, weight: .heavy))
                if savingAuto {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.7)
                }
                Text(savingAuto
                     ? L10n.recapCoverPickerSaving.string
                     : L10n.recapCoverPickerAuto.string)
                    .font(.system(size: 13, weight: .heavy))
                Spacer()
                if currentCoverId == nil && !savingAuto {
                    Text(L10n.recapCoverPickerSelected.string.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.4)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue.opacity(0.18)))
                        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .foregroundColor(.white)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(currentCoverId == nil ? GymCircleTheme.ColorToken.electricBlue.opacity(0.32) : Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(savingAuto || savingPostId != nil)
    }

    private func errorPill(_ msg: String) -> some View {
        Text(msg)
            .font(.system(size: 11, weight: .heavy))
            .foregroundColor(Color(red: 1.0, green: 0.42, blue: 0.42))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color(red: 1.0, green: 0.42, blue: 0.42).opacity(0.10))
            )
    }

    // MARK: - Persist (Sprint 9.7.5)

    @MainActor
    private func persist(_ postId: String?) async {
        saveError = nil
        if let pid = postId {
            savingPostId = pid
        } else {
            savingAuto = true
        }
        let ok = await onSelect(postId)
        if ok {
            Haptics.success()
            onClose() // auto-close pós sucesso (paridade web)
        } else {
            Haptics.error()
            saveError = L10n.recapCoverPickerErrorSave.string
        }
        savingPostId = nil
        savingAuto = false
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.white.opacity(0.06)))
                    .foregroundColor(.white)
            }
            Spacer()
            VStack(spacing: 2) {
                Text(L10n.recapCoverPickerTitle.string)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundColor(.white)
                Text(monthLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white.opacity(0.52))
            }
            Spacer()
            Spacer().frame(width: 36)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // MARK: - Grid

    private var photosGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 3), spacing: 4) {
            ForEach(posts, id: \.postId) { post in
                photoCell(post)
            }
        }
    }

    private func photoCell(_ post: MonthCalendarPost) -> some View {
        let isSelected = selectedPostId == post.postId
        let isSaving = savingPostId == post.postId
        return Button(action: {
            if !isSelected { Haptics.selection() } // Sprint 9.6.2
            selectedPostId = post.postId
        }) {
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: post.imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Color.white.opacity(0.04)
                    }
                }
                .aspectRatio(1, contentMode: .fill)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            isSelected ? GymCircleTheme.ColorToken.electricBlue : Color.clear,
                            lineWidth: 3
                        )
                )

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundColor(GymCircleTheme.ColorToken.electricBlue)
                        .background(Circle().fill(.black.opacity(0.5)))
                        .padding(6)
                }

                // Sprint 9.7.5 — overlay "Salvando..." durante persistência (paridade web)
                if isSaving {
                    ZStack {
                        Color.black.opacity(0.5)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(spacing: 6) {
                            ProgressView().tint(.white)
                            Text(L10n.recapCoverPickerSaving.string)
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundColor(.white)
                        }
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(savingPostId != nil || savingAuto)
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 32))
                .foregroundColor(.white.opacity(0.32))
            Text(L10n.recapCoverPickerEmpty.string)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white.opacity(0.52))
                .multilineTextAlignment(.center)
        }
        .padding(48)
    }

    // MARK: - Confirm

    private func confirmBar(postId: String) -> some View {
        VStack(spacing: 0) {
            Divider().background(Color.white.opacity(0.06))
            Button(action: { Task { await persist(postId) } }) {
                HStack(spacing: 8) {
                    if savingPostId == postId {
                        ProgressView().tint(.black).scaleEffect(0.7)
                    }
                    Text(savingPostId == postId
                         ? L10n.recapCoverPickerSaving.string
                         : L10n.recapCoverPickerConfirm.string)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(.black)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue))
                .padding(.horizontal, 20)
            }
            .buttonStyle(.plain)
            .padding(.vertical, 12)
            .disabled(savingPostId != nil || savingAuto)
        }
        .background(GymCircleTheme.ColorToken.appBackground)
    }
}

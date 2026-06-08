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
    public let onSelect: (String) -> Void
    public let onClose: () -> Void

    @State private var selectedPostId: String?

    public init(
        posts: [MonthCalendarPost],
        currentCoverId: String? = nil,
        monthLabel: String,
        onSelect: @escaping (String) -> Void,
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

                if posts.isEmpty {
                    Spacer()
                    emptyState
                    Spacer()
                } else {
                    ScrollView {
                        photosGrid
                            .padding(20)
                    }
                }

                if let pid = selectedPostId {
                    confirmBar(postId: pid)
                }
            }
        }
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
            }
        }
        .buttonStyle(.plain)
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
            Button(action: { onSelect(postId) }) {
                Text(L10n.recapCoverPickerConfirm.string)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(GymCircleTheme.ColorToken.electricBlue))
                    .padding(.horizontal, 20)
            }
            .buttonStyle(.plain)
            .padding(.vertical, 12)
        }
        .background(GymCircleTheme.ColorToken.appBackground)
    }
}

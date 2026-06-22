import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// ComposerView — Sprint 20.4a/b. Substitui o placeholder da tab Criar.
///
/// 20.4a: fotos da galeria (até 10), legenda, tags (presets + livre, máx 5)
/// 20.4b: câmera, vídeo no carrossel, academia (gyms) e marcação de amigos
public struct ComposerView: View {
    @ObservedObject private var model: GymCircleAppModel

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var pickedMedia: [PickedMedia] = []
    @State private var caption = ""
    @State private var selectedTags: [String] = []
    @State private var customTag = ""
    // Paridade web: feed + story como destinos, ambos default ligados.
    @State private var postToFeed = true
    @State private var postToStory = true
    @State private var isPublishing = false
    @State private var publishedOK = false
    @State private var errorMessage: String?
    @State private var cameraPresented = false
    // Paridade web: opções avançadas começam colapsadas em "Mais opções".
    @State private var showMoreOptions = false
    // 20.4b — local (academia) + participantes
    @State private var gymQuery = ""
    @State private var gymResults: [GymOption] = []
    @State private var selectedGym: GymOption?
    @State private var following: [DiscoveredProfile] = []
    @State private var taggedUserIds: Set<String> = []
    @State private var gymSearchTask: Task<Void, Never>?

    struct PickedMedia: Identifiable {
        let id = UUID()
        let isVideo: Bool
        let data: Data
        let preview: UIImage?
    }

    /// Presets idênticos ao web (PostScreen) — valor PT-BR é o que
    /// persiste em workout_type/workout_types.
    private static let tagPresets = [
        "Musculação", "Corrida", "Bike", "Funcional", "Cardio", "Mobilidade",
    ]
    private static let maxMedias = 10
    private static let maxTags = 5

    public init(model: GymCircleAppModel) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                composerHeader
                mediaSection
                // Paridade web: legenda + opções + publicar só aparecem depois
                // que há mídia (a mídia é a protagonista da tela).
                if !pickedMedia.isEmpty {
                    captionSection
                    moreOptions
                    publishButton
                }
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: pickerItems) { newItems in
            Task { await loadPicked(newItems) }
        }
        .onChange(of: gymQuery) { newQuery in
            gymSearchTask?.cancel()
            gymSearchTask = Task {
                try? await Task.sleep(nanoseconds: 350_000_000)
                guard !Task.isCancelled else { return }
                gymResults = await model.searchGyms(query: newQuery)
            }
        }
        .task {
            following = await model.loadFollowingProfiles()
        }
        .sheet(isPresented: $cameraPresented) {
            CameraPicker { data in
                guard pickedMedia.count < Self.maxMedias else { return }
                pickedMedia.append(
                    PickedMedia(isVideo: false, data: data, preview: UIImage(data: data))
                )
            }
            .ignoresSafeArea()
        }
        .alert(Loc.publishedTitle, isPresented: $publishedOK) {
            Button(Loc.close, role: .cancel) {}
        } message: {
            Text(Loc.publishedBody)
        }
    }

    // MARK: - Sections

    // Header estilo web (TopBar): eyebrow em caps + título grande. O check-in
    // saiu do composer (web não tem; já existe a tab própria do pin).
    private var composerHeader: some View {
        VStack(alignment: .leading, spacing: 2) {
            GCText(Loc.t("Share your workout", "Compartilhe seu treino"), style: .sectionLabel)
            GCText(Loc.t("Post", "Postar"), style: .title)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var mediaSection: some View {
        if pickedMedia.isEmpty {
            emptyMediaCTA
        } else {
            filledMedia
        }
    }

    // Estado VAZIO (paridade web): caixa 4:5 com ícone de câmera, dica e os 2
    // CTAs (Câmera = marca / Galeria = sutil). A mídia é a protagonista.
    private var emptyMediaCTA: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(Color.white.opacity(0.02))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
            )
            .aspectRatio(4.0 / 5.0, contentMode: .fit)
            .overlay {
                VStack(spacing: 18) {
                    ZStack {
                        Circle().fill(Color.white.opacity(0.06))
                        Image(systemName: "camera")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.72))
                    }
                    .frame(width: 64, height: 64)

                    GCText(
                        Loc.t("Add a photo or video of your workout",
                              "Adicione uma foto ou vídeo do seu treino"),
                        style: .body,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                    .multilineTextAlignment(.center)

                    VStack(spacing: 10) {
                        Button { cameraPresented = true } label: {
                            Label(Loc.camera, systemImage: "camera.fill")
                                .font(.system(size: 14, weight: .black))
                                .foregroundStyle(.black)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Capsule().fill(GymCircleTheme.ColorToken.cyan))
                        }
                        .buttonStyle(.plain)

                        PhotosPicker(
                            selection: $pickerItems,
                            maxSelectionCount: Self.maxMedias,
                            matching: .any(of: [.images, .videos])
                        ) {
                            Label(Loc.gallery, systemImage: "square.and.arrow.up")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(Capsule().fill(Color.white.opacity(0.06)))
                        }
                    }
                    .frame(maxWidth: 280)
                }
                .padding(24)
            }
    }

    // Estado PREENCHIDO: capa grande (item 0) + strip de gerenciamento.
    private var filledMedia: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topTrailing) {
                coverPreview
                PhotosPicker(
                    selection: $pickerItems,
                    maxSelectionCount: Self.maxMedias,
                    matching: .any(of: [.images, .videos])
                ) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(.black.opacity(0.62)))
                }
                .padding(10)
            }
            thumbStrip
        }
    }

    private var coverPreview: some View {
        ZStack {
            Color.black
            if let preview = pickedMedia.first?.preview {
                Image(uiImage: preview).resizable().scaledToFill()
            } else {
                Image(systemName: "video.fill")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .aspectRatio(4.0 / 5.0, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var thumbStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(Array(pickedMedia.enumerated()), id: \.element.id) { index, item in
                    ZStack(alignment: .topTrailing) {
                        Group {
                            if let preview = item.preview {
                                Image(uiImage: preview).resizable().scaledToFill()
                            } else {
                                ZStack {
                                    GymCircleTheme.ColorToken.elevatedCard
                                    Image(systemName: "video.fill")
                                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                }
                            }
                        }
                        .frame(width: 64, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button { pickedMedia.remove(at: index) } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white, .black.opacity(0.55))
                        }
                        .padding(2)

                        if index == 0 {
                            VStack {
                                Spacer()
                                chipLabel(Loc.cover).padding(4)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }

                if pickedMedia.count < Self.maxMedias {
                    PhotosPicker(
                        selection: $pickerItems,
                        maxSelectionCount: Self.maxMedias,
                        matching: .any(of: [.images, .videos])
                    ) {
                        addThumbLabel(icon: "plus")
                    }
                    Button { cameraPresented = true } label: {
                        addThumbLabel(icon: "camera.fill")
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func addThumbLabel(icon: String) -> some View {
        Image(systemName: icon)
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            .frame(width: 64, height: 80)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
            )
    }

    private func chipLabel(_ text: String) -> some View {
        GCText(text, style: .caption, color: .white)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(Capsule().fill(.black.opacity(0.55)))
    }

    // Paridade web: legenda inline sem moldura nem header (só placeholder).
    private var captionSection: some View {
        TextField(Loc.captionPlaceholder, text: $caption, axis: .vertical)
            .font(.system(size: 16, weight: .medium))
            .lineLimit(3...8)
            .tint(GymCircleTheme.ColorToken.cyan)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                GCText(Loc.workoutType, style: .sectionLabel)
                Spacer()
                GCText(
                    "\(selectedTags.count)/\(Self.maxTags)",
                    style: .caption,
                    color: GymCircleTheme.ColorToken.secondaryText
                )
            }

            TagChipsRow(
                presets: Self.tagPresets,
                selected: selectedTags,
                onToggle: { toggleTag($0) }
            )

            HStack(spacing: 8) {
                TextField(Loc.otherTag, text: $customTag)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(
                        Capsule().fill(GymCircleTheme.ColorToken.elevatedCard)
                    )
                Button {
                    let tag = customTag.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !tag.isEmpty else { return }
                    toggleTag(tag)
                    customTag = ""
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                }
                .buttonStyle(.plain)
                .disabled(customTag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    // 20.4b — academia opcional (location_source gym).
    private var gymSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            GCText(Loc.gymOptional, style: .sectionLabel)

            if let selectedGym {
                HStack(spacing: 8) {
                    Image(systemName: "mappin.circle.fill")
                        .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    VStack(alignment: .leading, spacing: 1) {
                        GCText(selectedGym.name, style: .body)
                        if !selectedGym.subtitle.isEmpty {
                            GCText(selectedGym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                        }
                    }
                    Spacer()
                    Button {
                        self.selectedGym = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.quietBlue)
                )
            } else {
                TextField(Loc.searchGymPlaceholder, text: $gymQuery)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(GymCircleTheme.ColorToken.elevatedCard)
                    )
                ForEach(gymResults.prefix(5)) { gym in
                    Button {
                        selectedGym = gym
                        gymQuery = ""
                        gymResults = []
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                GCText(gym.name, style: .body)
                                if !gym.subtitle.isEmpty {
                                    GCText(gym.subtitle, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                                }
                            }
                            Spacer()
                        }
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // 20.4b — marcar amigos (post_participants pending).
    @ViewBuilder
    private var participantsSection: some View {
        if !following.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                GCText(Loc.trainedWithSomeone, style: .sectionLabel)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(following) { person in
                            let isOn = taggedUserIds.contains(person.userId)
                            Button {
                                if isOn {
                                    taggedUserIds.remove(person.userId)
                                } else {
                                    taggedUserIds.insert(person.userId)
                                    Haptics.selection()
                                }
                            } label: {
                                VStack(spacing: 5) {
                                    GCAvatar(url: person.avatarURL, fallback: person.username ?? "u")
                                        .overlay(
                                            Circle().stroke(
                                                isOn ? GymCircleTheme.ColorToken.cyan : .clear,
                                                lineWidth: 2.5
                                            )
                                        )
                                    GCText(
                                        person.displayedName,
                                        style: .caption,
                                        color: isOn
                                            ? GymCircleTheme.ColorToken.cyan
                                            : GymCircleTheme.ColorToken.secondaryText
                                    )
                                    .lineLimit(1)
                                }
                                .frame(width: 64)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private var destinationsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            GCText(Loc.destination, style: .sectionLabel)
            // Paridade web: 2 pílulas (Feed + Story 24h), ambas ligadas. A dica
            // do estado fica embaixo do botão Publicar (destinationHint).
            HStack(spacing: 8) {
                destinationPill(isOn: $postToFeed, label: Loc.t("Feed", "Feed"))
                destinationPill(isOn: $postToStory, label: Loc.t("Story (24h)", "Story (24h)"))
            }
        }
    }

    private func destinationPill(isOn: Binding<Bool>, label: String) -> some View {
        Button { isOn.wrappedValue.toggle() } label: {
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(isOn.wrappedValue ? GymCircleTheme.ColorToken.cyan : Color.clear)
                        .overlay(
                            Circle().strokeBorder(
                                isOn.wrappedValue ? Color.clear : Color.white.opacity(0.22),
                                lineWidth: 1.5
                            )
                        )
                    if isOn.wrappedValue {
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .black))
                            .foregroundStyle(.black)
                    }
                }
                .frame(width: 16, height: 16)
                Text(label).font(.system(size: 13, weight: .black))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(
                Capsule().fill(
                    isOn.wrappedValue
                        ? GymCircleTheme.ColorToken.cyan.opacity(0.14)
                        : Color.white.opacity(0.05)
                )
            )
            .foregroundStyle(
                isOn.wrappedValue
                    ? GymCircleTheme.ColorToken.cyan
                    : GymCircleTheme.ColorToken.secondaryText
            )
        }
        .buttonStyle(.plain)
    }

    // Paridade web `<details>`: opções avançadas colapsadas. Ordem do web:
    // tipo de treino · marcar amigos · local · destinos.
    private var moreOptions: some View {
        DisclosureGroup(isExpanded: $showMoreOptions) {
            VStack(alignment: .leading, spacing: 20) {
                tagsSection
                participantsSection
                gymSection
                destinationsSection
            }
            .padding(.top, 14)
        } label: {
            GCText(Loc.t("More options", "Mais opções"), style: .body)
        }
        .tint(GymCircleTheme.ColorToken.secondaryText)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.02))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    // Precisa de mídia E pelo menos um destino (paridade web hasDestination).
    private var canPublish: Bool {
        !pickedMedia.isEmpty && (postToFeed || postToStory)
    }

    // CTA muda conforme o destino (paridade web ctaBoth/ctaFeed/ctaStory).
    private var publishCTA: String {
        if postToFeed && postToStory { return Loc.t("Publish", "Publicar") }
        if postToStory && !postToFeed { return Loc.t("Publish story", "Publicar story") }
        return Loc.t("Publish to feed", "Publicar no feed")
    }

    // Dica do destino abaixo do botão (paridade web destinationHint).
    private var destinationHint: String {
        if postToFeed && postToStory { return Loc.t("Goes to the feed and stories.", "Vai pro feed e pros stories.") }
        if postToFeed { return Loc.t("Goes to the feed only.", "Vai só pro feed.") }
        if postToStory { return Loc.t("Goes to stories only (24h).", "Vai só pros stories (24h).") }
        return Loc.t("Pick at least one destination.", "Escolha ao menos um destino.")
    }

    private var publishButton: some View {
        VStack(spacing: 8) {
            Button {
                Task { await publish() }
            } label: {
                HStack(spacing: 8) {
                    if isPublishing {
                        ProgressView().tint(.black)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 16, weight: .black))
                        Text(publishCTA)
                            .font(.system(size: 16, weight: .black, design: .default))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    Capsule().fill(
                        canPublish
                            ? AnyShapeStyle(GymCircleTheme.ColorToken.cyan)
                            : AnyShapeStyle(GymCircleTheme.ColorToken.elevatedCard)
                    )
                )
                .foregroundStyle(canPublish ? .black : GymCircleTheme.ColorToken.secondaryText)
            }
            .buttonStyle(.plain)
            .disabled(!canPublish || isPublishing)

            GCText(destinationHint, style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)

            if let errorMessage {
                GCText(errorMessage, style: .caption, color: GymCircleTheme.ColorToken.pink)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Actions

    private func toggleTag(_ tag: String) {
        if let index = selectedTags.firstIndex(of: tag) {
            selectedTags.remove(at: index)
        } else if selectedTags.count < Self.maxTags {
            selectedTags.append(tag)
            Haptics.selection()
        }
    }

    private func loadPicked(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        let room = max(0, Self.maxMedias - pickedMedia.count)
        guard room > 0 else { pickerItems = []; return }
        var medias: [PickedMedia] = []
        for item in items.prefix(room) {
            let isVideo = item.supportedContentTypes.contains {
                $0.conforms(to: .movie) || $0.conforms(to: .audiovisualContent)
            }
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            medias.append(
                PickedMedia(
                    isVideo: isVideo,
                    data: data,
                    preview: isVideo ? nil : UIImage(data: data)
                )
            )
        }
        // Paridade web: galeria faz APPEND (não substitui); limpa o picker pra
        // a próxima seleção começar do zero (evita re-contar os já escolhidos).
        pickedMedia.append(contentsOf: medias)
        pickerItems = []
    }

    private func publish() async {
        guard !pickedMedia.isEmpty else { return }
        isPublishing = true
        errorMessage = nil
        defer { isPublishing = false }

        let inputs: [GymCircleAppModel.ComposerMediaInput] = pickedMedia.map {
            $0.isVideo ? .video($0.data) : .photo($0.data)
        }
        let ok = await model.publishPost(
            media: inputs,
            caption: caption,
            workoutTypes: selectedTags,
            gym: selectedGym,
            taggedUserIds: Array(taggedUserIds),
            postToFeed: postToFeed,
            postToStory: postToStory
        )
        if ok {
            Haptics.success()
            pickedMedia = []
            pickerItems = []
            caption = ""
            selectedTags = []
            selectedGym = nil
            postToFeed = true
            postToStory = true
            taggedUserIds = []
            publishedOK = true
        } else {
            Haptics.error()
            errorMessage = model.error ?? Loc.publishFailed
        }
    }
}

/// Chips de tag horizontais (presets + custom selecionadas).
struct TagChipsRow: View {
    let presets: [String]
    let selected: [String]
    let onToggle: (String) -> Void

    private var allChips: [String] {
        presets + selected.filter { !presets.contains($0) }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(allChips, id: \.self) { tag in
                    let isOn = selected.contains(tag)
                    Button {
                        onToggle(tag)
                    } label: {
                        Text(tag)
                            .font(.system(size: 13, weight: .bold, design: .default))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                Capsule().fill(
                                    isOn
                                        ? GymCircleTheme.ColorToken.cyan
                                        : GymCircleTheme.ColorToken.elevatedCard
                                )
                            )
                            .foregroundStyle(isOn ? .black : GymCircleTheme.ColorToken.primaryText)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// EditPostSheet — Sprint 20.4b/+. Edição de legenda + tags + MÍDIAS do
/// próprio post (paridade Sprint 14 web: add/remover até 10; setMedia
/// substitui post_media e atualiza a capa = item 0).
public struct EditPostSheet: View {
    @ObservedObject private var model: GymCircleAppModel
    private let post: FeedPost

    @Environment(\.dismiss) private var dismiss
    @State private var caption: String
    @State private var selectedTags: [String]
    @State private var customTag = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    // Mídias: existentes (URLs) + novas (Data local) — ordem final é
    // existentes mantidas seguidas das novas.
    @State private var existingItems: [PostComposerService.EditMediaItem]
    @State private var newImageDatas: [Data] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    private let originalCount: Int

    private var totalCount: Int { existingItems.count + newImageDatas.count }
    private var mediaChanged: Bool {
        existingItems.count != originalCount || !newImageDatas.isEmpty
    }

    public init(model: GymCircleAppModel, post: FeedPost) {
        self.model = model
        self.post = post
        _caption = State(initialValue: post.caption ?? "")
        _selectedTags = State(initialValue: post.workoutType.map { [$0] } ?? [])
        let items = post.carouselItems.map { item in
            PostComposerService.EditMediaItem(
                mediaType: item.mediaType?.rawValue ?? "image",
                imageURL: item.imageURL,
                thumbnailURL: item.thumbnailURL,
                posterURL: item.posterURL,
                mediaWidth: item.mediaWidth,
                mediaHeight: item.mediaHeight,
                mediaDurationSeconds: nil
            )
        }
        _existingItems = State(initialValue: items)
        originalCount = items.count
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    mediaEditor

                    VStack(alignment: .leading, spacing: 8) {
                        GCText(Loc.caption, style: .headline)
                        TextField(Loc.captionPlaceholder, text: $caption, axis: .vertical)
                            .lineLimit(3...6)
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(GymCircleTheme.ColorToken.elevatedCard)
                            )
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        GCText(Loc.workoutType, style: .headline)
                        TagChipsRow(
                            presets: ["Musculação", "Corrida", "Bike", "Funcional", "Cardio", "Mobilidade"],
                            selected: selectedTags,
                            onToggle: { tag in
                                if let index = selectedTags.firstIndex(of: tag) {
                                    selectedTags.remove(at: index)
                                } else if selectedTags.count < 5 {
                                    selectedTags.append(tag)
                                }
                            }
                        )
                        HStack(spacing: 8) {
                            TextField(Loc.t("Other", "Outro"), text: $customTag)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 9)
                                .background(Capsule().fill(GymCircleTheme.ColorToken.elevatedCard))
                            Button {
                                let tag = customTag.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !tag.isEmpty, selectedTags.count < 5 else { return }
                                selectedTags.append(tag)
                                customTag = ""
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 26))
                                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if let errorMessage {
                        GCText(errorMessage, style: .caption, color: GymCircleTheme.ColorToken.pink)
                    }
                }
                .padding(20)
            }
            .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle(Loc.editPost)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(Loc.cancel) { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                        } else {
                            Text(Loc.save).bold()
                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                        }
                    }
                    .disabled(isSaving || totalCount == 0)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onChange(of: pickerItems) { newItems in
            Task { await loadPicked(newItems) }
        }
    }

    private var mediaEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                GCText(Loc.medias, style: .headline)
                Spacer()
                GCText("\(totalCount)/10", style: .caption, color: GymCircleTheme.ColorToken.secondaryText)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(Array(existingItems.enumerated()), id: \.offset) { index, item in
                        editThumb(index: index, isExisting: true) {
                            MediaView(
                                url: item.thumbnailURL ?? item.posterURL ?? item.imageURL,
                                aspectRatio: 1,
                                isVideo: item.mediaType == "video"
                            )
                        }
                    }
                    ForEach(Array(newImageDatas.enumerated()), id: \.offset) { index, data in
                        editThumb(index: index, isExisting: false) {
                            if let image = UIImage(data: data) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                            }
                        }
                    }
                }
            }
            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: max(0, 10 - totalCount),
                matching: .images
            ) {
                Label(Loc.addPhotos, systemImage: "plus.square.on.square")
                    .font(.system(size: 14, weight: .bold, design: .default))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(GymCircleTheme.ColorToken.elevatedCard)
                    )
            }
            .disabled(totalCount >= 10)
        }
    }

    @ViewBuilder
    private func editThumb<Content: View>(
        index: Int,
        isExisting: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack(alignment: .topTrailing) {
            content()
                .frame(width: 84, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Button {
                if isExisting {
                    existingItems.remove(at: index)
                } else {
                    newImageDatas.remove(at: index)
                }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(.white, .black.opacity(0.55))
            }
            .padding(3)
            if isExisting && index == 0 {
                VStack {
                    Spacer()
                    GCText(Loc.cover, style: .caption, color: .white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(.black.opacity(0.55)))
                        .padding(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func loadPicked(_ items: [PhotosPickerItem]) async {
        var datas: [Data] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                datas.append(data)
            }
        }
        guard !datas.isEmpty else { return }
        newImageDatas.append(contentsOf: datas.prefix(max(0, 10 - totalCount)))
        pickerItems = []
    }

    private func save() async {
        guard totalCount > 0 else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        var media: [PostComposerService.EditMediaItem]?
        if mediaChanged {
            var combined = existingItems
            for data in newImageDatas {
                guard let uploaded = await model.uploadEditImage(data: data) else {
                    errorMessage = model.error ?? Loc.photoUploadFailed
                    return
                }
                combined.append(
                    PostComposerService.EditMediaItem(
                        mediaType: uploaded.mediaType,
                        imageURL: uploaded.imageURL,
                        thumbnailURL: uploaded.thumbnailURL,
                        posterURL: uploaded.posterURL,
                        mediaWidth: uploaded.width,
                        mediaHeight: uploaded.height,
                        mediaDurationSeconds: uploaded.durationSeconds
                    )
                )
            }
            media = combined
        }

        let ok = await model.updatePost(
            postId: post.id,
            caption: caption,
            workoutTypes: selectedTags,
            media: media
        )
        if ok {
            Haptics.success()
            dismiss()
        } else {
            errorMessage = model.error ?? Loc.couldNotSave
        }
    }
}

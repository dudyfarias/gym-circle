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
    @State private var alsoPublishStory = false
    @State private var isPublishing = false
    @State private var publishedOK = false
    @State private var errorMessage: String?
    @State private var cameraPresented = false
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
            VStack(alignment: .leading, spacing: 20) {
                checkInShortcut
                mediaSection
                captionSection
                tagsSection
                gymSection
                participantsSection
                destinationsSection
                publishButton
            }
            .padding(20)
        }
        .background(GymCircleTheme.ColorToken.appBackground.ignoresSafeArea())
        .navigationTitle("Criar treino")
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
        .alert("Treino publicado!", isPresented: $publishedOK) {
            Button("Fechar", role: .cancel) {}
        } message: {
            Text("Seu post ja esta no feed do circle.")
        }
    }

    // MARK: - Sections

    private var checkInShortcut: some View {
        NavigationLink {
            CheckInView(model: model)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                VStack(alignment: .leading, spacing: 2) {
                    GCText("Fazer check-in", style: .headline)
                    GCText(
                        "Marque a academia sem postar foto.",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(GymCircleTheme.ColorToken.card)
            )
        }
        .buttonStyle(.plain)
    }

    private var mediaSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            GCText("Midias do treino", style: .headline)

            if !pickedMedia.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(pickedMedia.enumerated()), id: \.element.id) { index, item in
                            ZStack(alignment: .topTrailing) {
                                Group {
                                    if let preview = item.preview {
                                        Image(uiImage: preview)
                                            .resizable()
                                            .scaledToFill()
                                    } else {
                                        ZStack {
                                            GymCircleTheme.ColorToken.elevatedCard
                                            Image(systemName: "video.fill")
                                                .foregroundStyle(GymCircleTheme.ColorToken.cyan)
                                        }
                                    }
                                }
                                .frame(width: 96, height: 120)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                                Button {
                                    pickedMedia.remove(at: index)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 20))
                                        .foregroundStyle(.white, .black.opacity(0.55))
                                }
                                .padding(4)

                                VStack {
                                    Spacer()
                                    HStack(spacing: 4) {
                                        if index == 0 {
                                            chipLabel("Capa")
                                        }
                                        if item.isVideo {
                                            chipLabel("Vídeo")
                                        }
                                    }
                                    .padding(6)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }
            }

            HStack(spacing: 10) {
                PhotosPicker(
                    selection: $pickerItems,
                    maxSelectionCount: Self.maxMedias,
                    matching: .any(of: [.images, .videos])
                ) {
                    pickButtonLabel(
                        "Galeria (\(pickedMedia.count)/\(Self.maxMedias))",
                        systemImage: "photo.on.rectangle.angled"
                    )
                }
                Button {
                    cameraPresented = true
                } label: {
                    pickButtonLabel("Câmera", systemImage: "camera.fill")
                }
                .buttonStyle(.plain)
                .disabled(pickedMedia.count >= Self.maxMedias)
            }
        }
    }

    private func chipLabel(_ text: String) -> some View {
        GCText(text, style: .caption, color: .white)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(Capsule().fill(.black.opacity(0.55)))
    }

    private func pickButtonLabel(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(GymCircleTheme.ColorToken.cyan)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(GymCircleTheme.ColorToken.elevatedCard)
            )
    }

    private var captionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            GCText("Legenda", style: .headline)
            TextField("Como foi o treino?", text: $caption, axis: .vertical)
                .lineLimit(3...6)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GymCircleTheme.ColorToken.elevatedCard)
                )
        }
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                GCText("Tipo de treino", style: .headline)
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
                TextField("Outro (ex: Natação)", text: $customTag)
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
            GCText("Academia (opcional)", style: .headline)

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
                TextField("Buscar academia...", text: $gymQuery)
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
                GCText("Treinou com alguem?", style: .headline)
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
        VStack(alignment: .leading, spacing: 10) {
            GCText("Destino", style: .headline)
            Toggle(isOn: $alsoPublishStory) {
                VStack(alignment: .leading, spacing: 2) {
                    GCText("Também publicar nos stories", style: .body)
                    GCText(
                        "Usa a primeira mídia e expira em 24h.",
                        style: .caption,
                        color: GymCircleTheme.ColorToken.secondaryText
                    )
                }
            }
            .tint(GymCircleTheme.ColorToken.cyan)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(GymCircleTheme.ColorToken.elevatedCard)
            )
        }
    }

    private var publishButton: some View {
        VStack(spacing: 10) {
            if let errorMessage {
                GCText(errorMessage, style: .caption, color: GymCircleTheme.ColorToken.pink)
            }
            Button {
                Task { await publish() }
            } label: {
                Group {
                    if isPublishing {
                        ProgressView().tint(.black)
                    } else {
                        Text("Publicar treino")
                            .font(.system(size: 16, weight: .black, design: .rounded))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(
                            pickedMedia.isEmpty
                                ? AnyShapeStyle(GymCircleTheme.ColorToken.elevatedCard)
                                : AnyShapeStyle(GymCircleTheme.ColorToken.cyan)
                        )
                )
                .foregroundStyle(pickedMedia.isEmpty ? GymCircleTheme.ColorToken.secondaryText : .black)
            }
            .buttonStyle(.plain)
            .disabled(pickedMedia.isEmpty || isPublishing)
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
        var medias: [PickedMedia] = []
        for item in items.prefix(Self.maxMedias) {
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
        pickedMedia = medias
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
            alsoPublishStory: alsoPublishStory
        )
        if ok {
            Haptics.success()
            pickedMedia = []
            pickerItems = []
            caption = ""
            selectedTags = []
            selectedGym = nil
            alsoPublishStory = false
            taggedUserIds = []
            publishedOK = true
        } else {
            Haptics.error()
            errorMessage = model.error ?? "Nao foi possivel publicar. Tenta de novo."
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
                            .font(.system(size: 13, weight: .bold, design: .rounded))
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
                        GCText("Legenda", style: .headline)
                        TextField("Como foi o treino?", text: $caption, axis: .vertical)
                            .lineLimit(3...6)
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(GymCircleTheme.ColorToken.elevatedCard)
                            )
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        GCText("Tipo de treino", style: .headline)
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
                            TextField("Outro", text: $customTag)
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
            .navigationTitle("Editar post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(GymCircleTheme.ColorToken.secondaryText)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().tint(GymCircleTheme.ColorToken.cyan)
                        } else {
                            Text("Salvar").bold()
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
                GCText("Mídias", style: .headline)
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
                Label("Adicionar fotos", systemImage: "plus.square.on.square")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
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
                    GCText("Capa", style: .caption, color: .white)
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
                    errorMessage = model.error ?? "Falha no upload de uma das fotos."
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
            errorMessage = model.error ?? "Não foi possível salvar."
        }
    }
}

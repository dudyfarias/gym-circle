import Foundation

/// Loc — Punch-list #3 (i18n EN nas telas novas).
///
/// Helper leve PT/EN pras telas pós-Sprint 9 (Feed interativo, Composer,
/// Chat, Check-in, Notificações, Hall, Settings e sheets). Mesma decisão
/// "inline no Swift" do L10n, mas sem inchar aquele switch gigante.
///
/// Default PT-BR (mercado v1.1); EN quando o idioma do device não é pt.
public enum Loc {
    /// Resolve PT/EN pelo idioma EFETIVO do app — o override do usuário em
    /// AppLocalization (Ajustes), ou o idioma do device se ele nunca escolheu.
    public static func t(_ en: String, _ pt: String) -> String {
        AppLocalization.code == "pt" ? pt : en
    }

    private static var isEN: Bool {
        AppLocalization.code == "en"
    }

    // MARK: - Feed
    public static var myCircle: String { t("My Circle", "Meu Circle") }
    public static var notifications: String { t("Notifications", "Notificações") }
    public static var searchPeople: String { t("Search people", "Buscar pessoas") }
    // Copy 1:1 com o web (feed.empty.*).
    public static var feedEmptyTitle: String { t("Your feed is quiet", "Seu feed está quieto") }
    public static var feedEmptySubtitle: String {
        t("When your circle posts workouts, they'll show up here with streaks, likes, and comments.",
          "Quando seu circle publicar treinos, eles aparecem aqui com streak, curtidas e comentários.")
    }
    // Copy 1:1 com o web (feed.error.* + common.retry).
    public static var feedErrorTitle: String { t("Couldn't load the feed", "Não foi possível carregar o feed") }
    public static var feedErrorSubtitle: String {
        t("Check your connection and try again.",
          "Verifique sua conexão e tente de novo.")
    }
    public static var tryAgain: String { t("Try again", "Tentar de novo") }
    public static var loadingFeed: String { t("Loading feed", "Carregando feed") }
    public static var like: String { t("Like", "Curtir") }
    public static var unlike: String { t("Unlike", "Descurtir") }
    public static var comments: String { t("Comments", "Comentários") }
    public static var seeWhoLiked: String { t("See who liked", "Ver quem curtiu") }
    public static var taggedInWorkout: String { t("You were tagged in this workout", "Te marcaram neste treino") }
    public static var accept: String { t("Accept", "Aceitar") }
    public static var decline: String { t("Decline", "Recusar") }
    public static func withPeople(_ names: String) -> String { t("with \(names)", "com \(names)") }
    public static var editPost: String { t("Edit post", "Editar post") }
    public static var deletePost: String { t("Delete post", "Apagar post") }
    public static var deletePostConfirm: String { t("Delete this post?", "Apagar este post?") }
    public static func muteUser(_ user: String) -> String { t("Mute @\(user)", "Silenciar @\(user)") }
    public static var reportPost: String { t("Report post", "Denunciar post") }
    public static var post: String { t("Post", "Post") }
    public static var close: String { t("Close", "Fechar") }
    public static var cancel: String { t("Cancel", "Cancelar") }
    public static var save: String { t("Save", "Salvar") }
    public static func mediaCounter(_ n: Int, _ total: Int) -> String { "\(n)/\(total)" }

    // MARK: - Comments
    public static var loadingComments: String { t("Loading comments", "Carregando comentários") }
    // Copy 1:1 com o web (comments.empty.*).
    public static var noCommentsTitle: String { t("No comments yet", "Ainda não há nenhum comentário") }
    public static var noCommentsSubtitle: String {
        t("Start the conversation with a quick message.",
          "Inicie a conversa com uma mensagem rápida.")
    }
    public static var reply: String { t("Reply", "Responder") }
    public static func replyingTo(_ user: String) -> String { t("Replying to @\(user)", "Respondendo @\(user)") }
    public static var commentPlaceholder: String { t("Comment...", "Comentar...") }
    public static var delete: String { t("Delete", "Apagar") }

    // MARK: - Likes
    public static var likesTitle: String { t("Likes", "Curtidas") }
    public static var loadingLikes: String { t("Loading likes", "Carregando curtidas") }
    public static var noLikesTitle: String { t("No likes yet", "Nenhuma curtida ainda") }
    public static var noLikesSubtitle: String { t("Be the first to like this workout.", "Seja o primeiro a curtir este treino.") }

    // MARK: - People search
    public static var search: String { t("Search", "Buscar") }
    public static var searchPeoplePlaceholder: String { t("Search people...", "Buscar pessoas...") }
    public static var noneFoundTitle: String { t("Nobody found", "Ninguém encontrado") }
    public static var noneFoundSubtitle: String { t("Try another name or @username.", "Tenta outro nome ou @username.") }
    public static var suggestionsForYou: String { t("Suggestions for you", "Sugestões pra você") }

    // MARK: - Notifications
    public static var loadingNotifications: String { t("Loading notifications", "Carregando notificações") }
    public static var noNotificationsTitle: String { t("Nothing here yet", "Nada por aqui") }
    public static var noNotificationsSubtitle: String {
        t("Likes, comments and new followers show up here.",
          "Curtidas, comentários e novos seguidores aparecem aqui.")
    }
    public static func notifLike() -> String { t("liked your workout", "curtiu seu treino") }
    public static func notifComment() -> String { t("commented on your workout", "comentou no seu treino") }
    public static func notifCommentLike() -> String { t("liked your comment", "curtiu seu comentário") }
    public static func notifCommentReply() -> String { t("replied to your comment", "respondeu seu comentário") }
    public static func notifFollow() -> String { t("started following you", "começou a te seguir") }
    public static func notifFollowRequest() -> String { t("wants to follow you", "quer te seguir") }
    public static func notifMention() -> String { t("mentioned you", "mencionou você") }
    public static func notifStoryLike() -> String { t("liked your story", "curtiu seu story") }
    public static func notifPostTag() -> String { t("tagged you in a workout", "te marcou num treino") }
    public static func notifStoryTag() -> String { t("tagged you in a story", "te marcou num story") }
    public static var notifDefault: String { t("new notification", "nova notificação") }

    // MARK: - Composer
    public static var createWorkout: String { t("Create workout", "Criar treino") }
    public static var workoutMedias: String { t("Workout medias", "Mídias do treino") }
    public static var gallery: String { t("Gallery", "Galeria") }
    public static var camera: String { t("Camera", "Câmera") }
    public static var cover: String { t("Cover", "Capa") }
    public static var video: String { t("Video", "Vídeo") }
    public static var caption: String { t("Caption", "Legenda") }
    public static var captionPlaceholder: String { t("How was the workout?", "Como foi o treino?") }
    public static var workoutType: String { t("Workout type", "Tipo de treino") }
    public static var otherTag: String { t("Other (e.g. Swimming)", "Outro (ex: Natação)") }
    public static var gymOptional: String { t("Gym (optional)", "Academia (opcional)") }
    public static var searchGymPlaceholder: String { t("Search gym...", "Buscar academia...") }
    public static var trainedWithSomeone: String { t("Trained with someone?", "Treinou com alguém?") }
    public static var publishWorkout: String { t("Publish workout", "Publicar treino") }
    public static var publishedTitle: String { t("Workout published!", "Treino publicado!") }
    public static var publishedBody: String { t("Your post is already on the circle feed.", "Seu post já está no feed do circle.") }
    public static var publishFailed: String { t("Couldn't publish. Try again.", "Não foi possível publicar. Tenta de novo.") }
    public static func chooseMedias(_ max: Int) -> String { t("Choose photos (up to \(max))", "Escolher fotos (até \(max))") }
    public static var addPhotos: String { t("Add photos", "Adicionar fotos") }
    public static var photoUploadFailed: String { t("Upload of one of the photos failed.", "Falha no upload de uma das fotos.") }
    public static var couldNotSave: String { t("Couldn't save.", "Não foi possível salvar.") }
    public static var medias: String { t("Medias", "Mídias") }
    public static var doCheckIn: String { t("Check in", "Fazer check-in") }
    public static var checkInShortcut: String { t("Mark the gym without posting a photo.", "Marque a academia sem postar foto.") }
    public static var destination: String { t("Destination", "Destino") }
    public static var alsoPublishStory: String { t("Also publish to stories", "Também publicar nos stories") }
    public static var storyHint: String { t("Uses the first media and expires in 24h.", "Usa a primeira mídia e expira em 24h.") }

    // MARK: - Chat
    public static var chat: String { t("Chat", "Conversas") }
    public static var loadingConversations: String { t("Loading conversations", "Carregando conversas") }
    public static var noConversationsTitle: String { t("No conversations", "Nenhuma conversa") }
    public static var noConversationsSubtitle: String {
        t("Call someone from the circle to chat about training.",
          "Chama alguém do circle pra trocar ideia sobre treino.")
    }
    public static var newMessage: String { t("New message", "Nova mensagem") }
    public static var deleteForMe: String { t("Delete for me", "Apagar pra mim") }
    public static var noFollowsTitle: String { t("You don't follow anyone yet", "Você ainda não segue ninguém") }
    public static var noFollowsSubtitle: String { t("Follow people to start a chat.", "Siga pessoas pra puxar conversa.") }
    public static var groupName: String { t("Group name", "Nome do grupo") }
    public static var newGroup: String { t("New group", "Novo grupo") }
    public static var createGroup: String { t("Create group", "Criar grupo") }
    public static var loadingMessages: String { t("Loading messages", "Carregando mensagens") }
    public static var startChatTitle: String { t("Start the chat", "Começa o papo") }
    public static var startChatSubtitle: String { t("Send the first message.", "Manda a primeira mensagem.") }
    public static var messagePlaceholder: String { t("Message...", "Mensagem...") }
    public static var repliedToStory: String { t("Replied to the story", "Respondeu ao story") }
    public static var photo: String { t("Photo", "Foto") }
    public static var directChat: String { t("Direct", "Direto") }
    public static var group: String { t("Group", "Grupo") }
    public static var create: String { t("Create", "Criar") }

    // MARK: - Check-in
    public static var checkIn: String { t("Check-in", "Check-in") }
    public static var checkInHeader: String { t("Mark where you trained", "Marque onde você treinou") }
    public static var checkInSubtitle: String {
        t("Use a registered gym or find nearby places via Apple Maps.",
          "Use uma academia cadastrada ou encontre lugares próximos pelo Apple Maps.")
    }
    public static var confirmCheckIn: String { t("Confirm check-in", "Confirmar check-in") }
    public static var searchGym: String { t("Search gym", "Buscar academia") }
    public static var gymNamePlaceholder: String { t("Gym name", "Nome da academia") }
    public static var useMyLocation: String { t("Use my location", "Usar minha localização") }
    public static var searchingNearby: String { t("Searching near you...", "Buscando perto de você...") }
    public static var registeredGymsNearby: String { t("Registered gyms near you", "Academias cadastradas perto de você") }
    public static var register: String { t("Register", "Cadastrar") }
    public static var noNearbyGyms: String {
        t("No gyms found nearby. Try searching by name.",
          "Não encontramos academias próximas. Tente buscar pelo nome.")
    }
    public static var locationDenied: String { t("Couldn't access your location.", "Não foi possível acessar sua localização.") }
    public static var couldNotRegisterPlace: String { t("Couldn't register this place.", "Não foi possível cadastrar este local.") }
    public static var checkInConfirmed: String { t("Check-in confirmed. Your circle knows you trained.", "Check-in confirmado. Seu circle sabe que você treinou.") }
    public static var checkInFailed: String { t("Couldn't check in.", "Não foi possível fazer check-in.") }

    // MARK: - Settings
    public static var settings: String { t("Settings", "Configurações") }
    public static var privacy: String { t("Privacy", "Privacidade") }
    public static var privateProfile: String { t("Private profile", "Perfil privado") }
    public static var privateProfileSubtitle: String { t("Only people you accept see your posts.", "Só quem você aceitar vê seus posts.") }
    public static var language: String { t("Language", "Idioma") }
    public static var appLanguage: String { t("App language", "Idioma do app") }
    public static var languageFollowsPhone: String {
        t("Follows the iPhone language (Settings > General > Language).",
          "Segue o idioma do iPhone (Ajustes > Geral > Idioma).")
    }
    public static var languageSystem: String { t("System (iPhone)", "Sistema (iPhone)") }
    public static var languagePickerHint: String {
        t("Choose the app language, independent of your iPhone. New installs start in the iPhone's language.",
          "Escolha o idioma do app, independente do iPhone. Numa instalação nova ele começa no idioma do iPhone.")
    }
    public static var iphoneSection: String { t("iPhone", "iPhone") }
    public static var enableNotifications: String { t("Enable notifications", "Ativar notificações") }
    public static var enableNotificationsSubtitle: String {
        t("Messages, likes and tags when push delivery is on.",
          "Mensagens, curtidas e marcações quando o envio push estiver ativo.")
    }
    public static var connectAppleHealth: String { t("Connect Apple Health", "Conectar Apple Saúde") }
    public static var connectAppleHealthSubtitle: String {
        t("Ready for kcal, duration and workouts in future recaps.",
          "Preparado para kcal, duração e treinos nos resumos futuros.")
    }
    public static var legal: String { t("Legal", "Legal") }
    public static var privacyPolicy: String { t("Privacy Policy", "Política de Privacidade") }
    public static var termsOfUse: String { t("Terms of Use", "Termos de Uso") }
    public static var support: String { t("Support", "Suporte") }
    public static var account: String { t("Account", "Conta") }
    public static var suspendAccount: String { t("Suspend account", "Suspender conta") }
    public static var suspendConfirm: String {
        t("Suspend your account? Your profile disappears until you reactivate via the emailed link.",
          "Suspender sua conta? Seu perfil some até você reativar pelo link enviado por e-mail.")
    }
    public static var deleteAccount: String { t("Delete account", "Apagar conta") }
    public static var deleteAccountConfirm: String {
        t("Delete your account? Deletion is permanent after the grace period.",
          "Apagar sua conta? A exclusão é definitiva após o período de carência.")
    }
    public static var signOut: String { t("Sign out", "Sair") }
    public static var portuguese: String { t("Portuguese", "Português") }
    public static var english: String { t("English", "Inglês") }
    public static var notifEnabledFeedback: String { t("Notifications enabled on this iPhone.", "Notificações ativadas neste iPhone.") }
    public static var notifEnableFailed: String { t("Couldn't enable notifications.", "Não foi possível ativar notificações.") }
    public static var healthConnectedFeedback: String { t("Apple Health connected for reading workouts.", "Apple Saúde conectado para leitura de treinos.") }
    public static var healthConnectFailed: String { t("Couldn't connect Apple Health.", "Não foi possível conectar o Apple Saúde.") }

    // MARK: - Hall (Achievements)
    public static var hallTitle: String { t("Hall of Fame", "Hall da Fama") }
    public static func earnedOf(_ n: Int, _ total: Int) -> String { t("\(n) of \(total) challenges", "\(n) de \(total) desafios") }
    public static func countOf(_ n: Int, _ total: Int) -> String { t("\(n) of \(total)", "\(n) de \(total)") }
    public static var nextPrize: String { t("NEXT CHALLENGE", "PRÓXIMO DESAFIO") }
    public static func progressOf(_ current: Int, _ target: Int) -> String { t("\(current) of \(target)", "\(current) de \(target)") }
    public static var featuredOne: String { t("Your featured achievement", "Sua conquista em destaque") }
    public static var showAll: String { t("Show all", "Mostrar tudo") }
    public static var allPrizes: String { t("All challenges", "Todos os desafios") }
    public static var allPrizesSubtitle: String { t("Everything you can earn on Gym Circle.", "Tudo que dá pra conquistar no Gym Circle.") }
    public static var earned: String { t("Earned", "Conquistado") }
    public static var locked: String { t("Locked", "Bloqueado") }
    public static var back: String { t("Back", "Voltar") }
    public static var badges: String { t("Badges", "Badges") }
    public static var medals: String { t("Medals", "Medalhas") }
    public static var trophies: String { t("Trophies", "Troféus") }
    public static var relics: String { t("Relics", "Relíquias") }
    public static var challenges: String { t("Challenges", "Desafios") }
    public static var badgesDesc: String { t("The entry achievements of your journey.", "As conquistas de entrada da sua jornada.") }
    public static var medalsDesc: String { t("Historic streak and consistency milestones.", "Marcos históricos de streak e constância.") }
    public static var trophiesDesc: String { t("Social feats and circle records.", "Feitos sociais e recordes do circle.") }
    public static var relicsDesc: String { t("Mythic rarities — very few have them.", "Raridades míticas — pouquíssimos têm.") }
    public static var challengesDesc: String { t("The themed challenges of each month.", "Os desafios temáticos de cada mês.") }
    // Sprint 22 — Hall agrupado por RARIDADE (mais raro → mais comum).
    public static var rarityCommonTitle: String { t("Common", "Comum") }
    public static var rarityUncommonTitle: String { t("Uncommon", "Incomum") }
    public static var rarityRareTitle: String { t("Rare", "Raro") }
    public static var rarityEpicTitle: String { t("Epic", "Épico") }
    public static var rarityLegendaryTitle: String { t("Legendary", "Lendário") }
    public static var rarityCommonDesc: String { t("First steps and everyday wins.", "Os primeiros passos e vitórias do dia a dia.") }
    public static var rarityUncommonDesc: String { t("Solid consistency milestones.", "Marcos sólidos de consistência.") }
    public static var rarityRareDesc: String { t("Rare challenges for the committed.", "Desafios raros, de quem treina firme.") }
    public static var rarityEpicDesc: String { t("Epic feats. Few make it here.", "Feitos épicos. Poucos chegam aqui.") }
    public static var rarityLegendaryDesc: String { t("The rarest challenges in Gym Circle.", "Os desafios mais raros do Gym Circle.") }

    // Sprint 19 — Competição (ranking por pontos).
    public static var competitionTitle: String { t("Competition", "Competição") }
    public static var competitionScopeCircle: String { t("Friends", "Amigos") }
    public static var competitionScopeGlobal: String { t("Global", "Geral") }
    public static var competitionPeriodWeek: String { t("Week", "Semana") }
    public static var competitionPeriodMonth: String { t("Month", "Mês") }
    public static var competitionPeriodYear: String { t("Year", "Ano") }
    public static var competitionYourPoints: String { t("YOUR POINTS", "SEUS PONTOS") }
    public static func competitionRankBadge(_ position: Int) -> String { t("#\(position)", "\(position)º") }
    public static var competitionBreakdownWorkouts: String { t("Workouts", "Treino") }
    public static var competitionBreakdownBonus: String { t("Bonus", "Bônus") }
    public static var competitionBreakdownAchievements: String { t("Achievements", "Conquistas") }
    public static var competitionEmptyCircle: String { t("Follow people to compete with your circle.", "Siga pessoas pra competir com seu circle.") }
    public static var competitionEmptyGlobal: String { t("No active athletes yet.", "Nenhum atleta ativo ainda.") }
    public static var competitionPts: String { t("pts", "pts") }
    public static func competitionWorkoutsCount(_ n: Int) -> String {
        n == 1 ? t("1 workout", "1 treino") : t("\(n) workouts", "\(n) treinos")
    }

    // MARK: - Profile / generic
    public static var profile: String { t("Profile", "Perfil") }
    public static var noStoriesTitle: String { t("No stories", "Sem stories") }
    public static var noStoriesSubtitle: String { t("This story expired or is no longer available.", "Esse story expirou ou não está mais disponível.") }
    public static func mediaOf(_ n: Int, _ total: Int) -> String { t("Media \(n) of \(total)", "Mídia \(n) de \(total)") }
    public static var replyPlaceholder: String { t("Reply...", "Responder...") }
    public static var muteStoriesConfirm: String { t("Mute stories from this user?", "Silenciar stories desse usuário?") }
    public static var mute: String { t("Mute", "Silenciar") }
}

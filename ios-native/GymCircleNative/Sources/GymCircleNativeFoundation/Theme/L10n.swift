import Foundation

/// L10n — Sprint 8.11.5.
///
/// Strings localizadas das 4 telas SwiftUI (MyCircle, AchievementDetail,
/// AchievementsView Hall da Fama, AchievementCelebration) + ProfileView.
///
/// Decisão: inline PT/EN no Swift em vez de `.strings` bundle. Razões:
///   1. Evita mexer no Package.swift (precisa `.process("Resources")` +
///      lproj dirs por linguagem, frágil em CI sem Xcode interativo)
///   2. Locale lookup via `Locale.current.language.languageCode` é trivial
///   3. Default PT-BR (mercado v1.1) com fallback EN se code != "pt"
///   4. Quando crescer a base de strings (>200), migrar pra `.strings` é
///      diff trivial — keys do enum ficam estáveis
///
/// Uso: `Text(L10n.myCircleStreakAtual.string)` ou `L10n.myCircleBadgesCount(earned: 5, total: 20).string`.
public enum L10n {
    // MARK: - MyCircleView

    case myCircleStreakAtual
    case myCircleMaiorStreak
    case myCircleTreinosMes
    case myCircleDiasAno
    case myCircleConquistas
    case myCircleTotal
    case myCircleSuaConsistencia
    case myCircleSemana
    case myCircleMes
    case myCircleAno
    case myCircleCalendarioMes
    case myCircleNiveis
    case myCircleDesafiosMes
    case myCircleCompartilharResumo
    case myCircleCompartilharResumoMes(String)
    case myCircleEscolheFoto
    case myCircleCompeticao
    case myCircleEmBreve
    case myCircleCompeticaoDescricao
    case myCircleOutroPeriodo
    case myCirclePrivacyTitle
    case myCirclePrivacyBody
    case myCircleFirstVisitHint
    case myCircleFirstVisitDismiss
    case recapCoverPickerTitle
    case recapCoverPickerEmpty
    case recapCoverPickerConfirm
    // Sprint 9.7.5
    case recapCoverPickerAuto
    case recapCoverPickerSaving
    case recapCoverPickerSelected
    case recapCoverPickerErrorSave
    case profileFollow
    case profileFollowing
    case profileFollowRequested
    case profileRequestFollow
    case profileMessage
    case profileLastPost
    case editProfileTitle
    case editProfileCancel
    case editProfileSave
    case editProfileDisplayName
    case editProfileBio
    case editProfileFitnessGoal
    case editProfilePrivateToggle
    case editProfilePrivateHint
    case editProfileChangeAvatarSoon
    case editProfileChangeAvatar
    case editProfileUploadingAvatar
    case editProfileUploadAvatarFailed
    // Sprint 9.7.1
    case editProfileUsername
    case editProfileUsernameInvalid
    case editProfileUsernameHint
    case editProfileUsernameTooShort
    case editProfileUsernameInvalidChars
    case editProfileInstagram
    case editProfileSports
    case editProfileSportsHint
    case editProfileBirthDate
    case editProfilePreferredTimes
    case editProfileBirthDateNone
    case editProfileSaveSuccess
    case editProfileGenericError
    // Sprint 9.9.1 — common a11y + UI labels
    case commonClose
    case commonBack
    case commonNext
    case commonPrev
    case calendarPrevMonth
    case calendarNextMonth
    case loginTagline
    case ringsWeek
    case streakDays
    // StreakLevel labels
    case levelIniciante
    case levelConsistente
    case levelElite
    case levelLendario
    case levelShortNovo
    case levelShortLenda
    case recapStatWorkouts
    case recapStatStreak
    case recapStatTopType
    case recapStatTopGym
    case recapChangeCover
    case recapShare
    // Sprint 9.7.2
    case recapEyebrow
    case recapTitle
    case recapHint
    case recapTagline
    case recapHeroSuffix
    case recapShareGenerating
    case recapDownload
    // Sprint 9.7.4 — Monthly Challenges difficulty
    case challengeDifficultyEasy
    case challengeDifficultyMedium
    case challengeDifficultyHard
    case challengeDifficultyLegendary
    case challengeSecretHint

    // MARK: - AchievementDetailView

    case detailVoceDesbloqueou
    case detailEmProgresso
    case detailProgresso
    case detailConquistado
    case detailTotalVezes(Int)
    case detailUltimaVez
    case detailNinguemConquistou
    case detailVoceEhPrimeiro
    case detailApenasPercent(String)
    case detailDescubraDesbloquear

    // Rarity chips
    case rarityComum
    case rarityIncomum
    case rarityRaro
    case rarityEpico
    case rarityLendario

    // MARK: - AchievementsView (Hall da Fama)

    case achievementsHallFama
    case achievementsXdeY(earned: Int, total: Int)
    case achievementsTudo
    case achievementsBadges
    case achievementsMedalhas
    case achievementsTrofeus
    case achievementsReliquias
    case achievementsDesafios
    case achievementsConquistados
    case achievementsProximos
    case achievementsBloqueados
    case achievementsVazio

    // MARK: - AchievementCelebrationView

    case celebrationContinuar
    case celebrationVerDepois
    case celebrationQueueIndex(index: Int, total: Int)

    // MARK: - ProfileView

    case profileConquistasDestaque
    case profileStreak
    case profileMaior
    case profilePosts
    case profileIndisponivel
    case profileEntreParaVer

    // MARK: - Resolver

    public var string: String {
        let isEN = Self.isEnglishLocale()
        switch self {
        // MyCircle
        case .myCircleStreakAtual:        return isEN ? "Current streak"     : "Streak atual"
        case .myCircleMaiorStreak:        return isEN ? "Best streak"        : "Maior streak"
        case .myCircleTreinosMes:         return isEN ? "Workouts this month": "Treinos no mês"
        case .myCircleDiasAno:            return isEN ? "Days this year"     : "Dias no ano"
        case .myCircleConquistas:         return isEN ? "Earned"             : "Conquistas"
        case .myCircleTotal:              return isEN ? "Total"              : "Total"
        case .myCircleSuaConsistencia:    return isEN ? "Your Consistency"   : "Sua Consistência"
        case .myCircleSemana:             return isEN ? "Week"               : "Semana"
        case .myCircleMes:                return isEN ? "Month"              : "Mês"
        case .myCircleAno:                return isEN ? "Year"               : "Ano"
        case .myCircleCalendarioMes:      return isEN ? "Monthly Calendar"   : "Calendário do mês"
        case .myCircleNiveis:             return isEN ? "Levels"             : "Níveis"
        case .myCircleDesafiosMes:        return isEN ? "Monthly challenges" : "Desafios do mês"
        case .myCircleCompartilharResumo: return isEN ? "Share monthly recap": "Compartilhar resumo"
        case .myCircleCompartilharResumoMes(let mes):
            return isEN ? "Share \(mes) recap" : "Compartilhar resumo de \(mes)"
        case .myCircleEscolheFoto:        return isEN ? "You pick the cover photo" : "Você escolhe a foto da capa"
        case .myCircleCompeticao:         return isEN ? "Competition"          : "Competição"
        case .myCircleEmBreve:            return isEN ? "Coming soon"          : "Em breve"
        case .myCircleCompeticaoDescricao:
            return isEN ? "Compete with your circle in weekly leagues."
                        : "Compita com seu circle em ligas semanais."
        case .myCircleOutroPeriodo:       return isEN ? "Pick another period"  : "Outro período"
        case .myCirclePrivacyTitle:       return isEN ? "Profile is private" : "Perfil é privado"
        case .myCirclePrivacyBody:
            return isEN
                ? "Follow this profile to see workouts, badges and challenges."
                : "Siga esse perfil pra ver treinos, badges e desafios."
        case .myCircleFirstVisitHint:
            return isEN
                ? "The rings track your consistency, badges celebrate streaks, and the calendar shows every workout day."
                : "Os anéis acompanham sua consistência, badges celebram streaks e o calendário mostra cada dia de treino."
        case .myCircleFirstVisitDismiss:
            return isEN ? "Got it" : "Entendi"

        // Recap cover picker
        case .recapCoverPickerTitle:
            return isEN ? "Pick a cover photo" : "Escolha a foto da capa"
        case .recapCoverPickerEmpty:
            return isEN
                ? "No photos in this month yet. Post a workout to see them here."
                : "Nenhuma foto neste mês. Posta um treino pra aparecer aqui."
        case .recapCoverPickerConfirm:
            return isEN ? "Use as cover" : "Usar como capa"
        // Sprint 9.7.5
        case .recapCoverPickerAuto:
            return isEN ? "Use automatic photo" : "Usar foto automática"
        case .recapCoverPickerSaving:
            return isEN ? "Saving..." : "Salvando..."
        case .recapCoverPickerSelected:
            return isEN ? "Selected" : "Selecionado"
        case .recapCoverPickerErrorSave:
            return isEN ? "Save failed. Try again." : "Falha ao salvar. Tente novamente."

        // Other profile actions
        case .profileFollow:           return isEN ? "Follow"            : "Seguir"
        case .profileFollowing:        return isEN ? "Following"         : "Seguindo"
        case .profileFollowRequested:  return isEN ? "Requested"         : "Pendente"
        case .profileRequestFollow:    return isEN ? "Request"           : "Solicitar"
        case .profileMessage:          return isEN ? "Message"           : "Mensagem"
        case .profileLastPost:         return isEN ? "LAST WORKOUT"      : "ÚLTIMO TREINO"

        // Edit profile
        case .editProfileTitle:       return isEN ? "Edit profile"     : "Editar perfil"
        case .editProfileCancel:      return isEN ? "Cancel"           : "Cancelar"
        case .editProfileSave:        return isEN ? "Save"             : "Salvar"
        case .editProfileDisplayName: return isEN ? "Display name"     : "Nome de exibição"
        case .editProfileBio:         return isEN ? "Bio"              : "Bio"
        case .editProfileFitnessGoal: return isEN ? "Fitness goal"     : "Meta fitness"
        case .editProfilePrivateToggle:
            return isEN ? "Private account" : "Conta privada"
        case .editProfilePrivateHint:
            return isEN
                ? "Only approved followers see your posts."
                : "Apenas seguidores aprovados veem seus posts."
        case .editProfileChangeAvatarSoon:
            return isEN ? "Avatar upload coming soon" : "Troca de avatar em breve"
        case .editProfileChangeAvatar:
            return isEN ? "Change avatar" : "Trocar avatar"
        case .editProfileUploadingAvatar:
            return isEN ? "Uploading..." : "Enviando..."
        case .editProfileUploadAvatarFailed:
            return isEN
                ? "Avatar upload failed. Try again."
                : "Falha ao enviar avatar. Tente novamente."
        // Sprint 9.7.1
        case .editProfileUsername:
            return isEN ? "Username" : "Nome de usuário"
        case .editProfileUsernameInvalid:
            return isEN ? "INVALID" : "INVÁLIDO"
        case .editProfileUsernameHint:
            return isEN
                ? "3-32 chars: lowercase letters, numbers, _ or ."
                : "3-32 caracteres: letras minúsculas, números, _ ou ."
        case .editProfileUsernameTooShort:
            return isEN ? "At least 3 characters" : "Mínimo 3 caracteres"
        case .editProfileUsernameInvalidChars:
            return isEN
                ? "Only lowercase letters, numbers, _ and . allowed"
                : "Apenas letras minúsculas, números, _ e . são permitidos"
        case .editProfileInstagram:
            return isEN ? "Instagram username" : "Usuário do Instagram"
        case .editProfileSports:
            return isEN ? "Sports" : "Esportes"
        case .editProfileSportsHint:
            return isEN ? "comma-separated" : "separados por vírgula"
        case .editProfileBirthDate:
            return isEN ? "Birth date" : "Data de nascimento"
        case .editProfilePreferredTimes:
            return isEN ? "Preferred training times" : "Horários preferidos de treino"
        case .editProfileBirthDateNone:
            return isEN ? "Not set" : "Não definida"
        case .editProfileSaveSuccess:
            return isEN ? "Profile updated" : "Perfil atualizado"
        case .editProfileGenericError:
            return isEN
                ? "Couldn't save changes. Try again."
                : "Não foi possível salvar. Tente novamente."

        // Sprint 9.9.1 — common
        case .commonClose:        return isEN ? "Close"     : "Fechar"
        case .commonBack:         return isEN ? "Back"      : "Voltar"
        case .commonNext:         return isEN ? "Next"      : "Próximo"
        case .commonPrev:         return isEN ? "Previous"  : "Anterior"
        case .calendarPrevMonth:  return isEN ? "Previous month" : "Mês anterior"
        case .calendarNextMonth:  return isEN ? "Next month"     : "Próximo mês"
        case .loginTagline:       return isEN ? "Train together" : "Treine junto"
        case .ringsWeek:          return isEN ? "WEEK"      : "SEMANA"
        case .streakDays:         return isEN ? "days"      : "dias"
        // StreakLevel
        case .levelIniciante:     return isEN ? "Beginner"    : "Iniciante"
        case .levelConsistente:   return isEN ? "Consistent"  : "Consistente"
        case .levelElite:         return isEN ? "Elite"       : "Elite"
        case .levelLendario:      return isEN ? "Legendary"   : "Lendário"
        case .levelShortNovo:     return isEN ? "New"   : "Novo"
        case .levelShortLenda:    return isEN ? "Legend": "Lenda"

        // Monthly recap
        case .recapStatWorkouts:  return isEN ? "Workouts"     : "Treinos"
        case .recapStatStreak:    return isEN ? "Best streak"  : "Sequência"
        case .recapStatTopType:   return isEN ? "Top type"     : "Tipo+"
        case .recapStatTopGym:    return isEN ? "Top gym"      : "Lugar+"
        case .recapChangeCover:   return isEN ? "Change cover" : "Trocar foto"
        case .recapShare:         return isEN ? "Share"        : "Compartilhar"

        // Sprint 9.7.2
        case .recapEyebrow:
            return isEN ? "Monthly recap" : "Resumo do mês"
        case .recapTitle:
            return isEN ? "Your month, shareable" : "Seu mês compartilhável"
        case .recapHint:
            return isEN
                ? "Tap share to send to friends or social. The image is generated locally on your device."
                : "Toque em compartilhar para enviar aos amigos ou redes. A imagem é gerada localmente no seu device."
        case .recapTagline:
            return isEN ? "Gym Circle" : "Gym Circle"
        case .recapHeroSuffix:
            return isEN ? "Workouts in month" : "Dias de treino no mês"
        case .recapShareGenerating:
            return isEN ? "Generating..." : "Gerando..."
        case .recapDownload:
            return isEN ? "Download" : "Baixar"

        // Sprint 9.7.4 — Monthly Challenges
        case .challengeDifficultyEasy:      return isEN ? "Easy"      : "Fácil"
        case .challengeDifficultyMedium:    return isEN ? "Medium"    : "Médio"
        case .challengeDifficultyHard:      return isEN ? "Hard"      : "Difícil"
        case .challengeDifficultyLegendary: return isEN ? "Legendary" : "Lendário"
        case .challengeSecretHint:
            return isEN
                ? "Secret challenge — discover how to unlock."
                : "Desafio secreto — descubra como conquistar."

        // Detail
        case .detailVoceDesbloqueou: return isEN ? "YOU UNLOCKED" : "VOCÊ DESBLOQUEOU"
        case .detailEmProgresso:     return isEN ? "IN PROGRESS"   : "EM PROGRESSO"
        case .detailProgresso:       return isEN ? "PROGRESS"      : "PROGRESSO"
        case .detailConquistado:     return isEN ? "Earned"        : "Conquistado"
        case .detailTotalVezes(let n):
            return isEN ? "\(n) times" : "\(n) vezes"
        case .detailUltimaVez:       return isEN ? "Last time"     : "Última vez"
        case .detailNinguemConquistou:
            return isEN
                ? "Nobody has earned this yet. Be the first!"
                : "Ninguém conquistou esta ainda. Seja o primeiro!"
        case .detailVoceEhPrimeiro:
            return isEN ? "✦ You're the first to earn this!" : "✦ Você é o primeiro a conquistar esta!"
        case .detailApenasPercent(let pct):
            return isEN ? "Only \(pct) of users have this achievement." : "Apenas \(pct) dos usuários possuem esta conquista."
        case .detailDescubraDesbloquear:
            return isEN ? "Discover how to unlock" : "Descubra como desbloquear"

        // Rarity
        case .rarityComum:     return isEN ? "Common"    : "Comum"
        case .rarityIncomum:   return isEN ? "Uncommon"  : "Incomum"
        case .rarityRaro:      return isEN ? "Rare"      : "Raro"
        case .rarityEpico:     return isEN ? "Epic"      : "Épico"
        case .rarityLendario:  return isEN ? "Legendary" : "Lendário"

        // Hall da Fama
        case .achievementsHallFama:    return isEN ? "Hall of Fame" : "Hall da Fama"
        case .achievementsXdeY(let earned, let total):
            return isEN ? "\(earned) of \(total) earned" : "\(earned) de \(total) conquistadas"
        case .achievementsTudo:        return isEN ? "All"         : "Tudo"
        case .achievementsBadges:      return isEN ? "Badges"      : "Badges"
        case .achievementsMedalhas:    return isEN ? "Medals"      : "Medalhas"
        case .achievementsTrofeus:     return isEN ? "Trophies"    : "Troféus"
        case .achievementsReliquias:   return isEN ? "Relics"      : "Relíquias"
        case .achievementsDesafios:    return isEN ? "Challenges"  : "Desafios"
        case .achievementsConquistados:return isEN ? "Earned"      : "Conquistados"
        case .achievementsProximos:    return isEN ? "Next up"     : "Próximos"
        case .achievementsBloqueados:  return isEN ? "Locked"      : "Bloqueados"
        case .achievementsVazio:       return isEN ? "No achievements in this category yet." : "Nenhuma conquista nesta categoria ainda."

        // Celebration
        case .celebrationContinuar: return isEN ? "Continue" : "Continuar"
        case .celebrationVerDepois: return isEN ? "View later" : "Ver depois"
        case .celebrationQueueIndex(let i, let total):
            return isEN ? "\(i) OF \(total)" : "\(i) DE \(total)"

        // Profile
        case .profileConquistasDestaque: return isEN ? "FEATURED ACHIEVEMENTS" : "CONQUISTAS EM DESTAQUE"
        case .profileStreak:             return isEN ? "Streak" : "Streak"
        case .profileMaior:              return isEN ? "Best"   : "Maior"
        case .profilePosts:              return isEN ? "Posts"  : "Posts"
        case .profileIndisponivel:       return isEN ? "Profile unavailable" : "Perfil indisponível"
        case .profileEntreParaVer:       return isEN ? "Sign in to see your native profile." : "Entre na conta para ver seu perfil nativo."
        }
    }

    private static func isEnglishLocale() -> Bool {
        let code = Locale.current.language.languageCode?.identifier
            ?? Locale.current.identifier.prefix(2).lowercased()
        return code.hasPrefix("en")
    }
}

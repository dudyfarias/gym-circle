import SwiftUI

public enum GymCircleTheme {
    public enum ColorToken {
        public static let appBackground = Color.black
        public static let card = Color(red: 0.067, green: 0.067, blue: 0.067)
        public static let elevatedCard = Color(red: 0.110, green: 0.110, blue: 0.118)
        public static let separator = Color.white.opacity(0.06)
        public static let primaryText = Color.white
        public static let secondaryText = Color(red: 0.631, green: 0.631, blue: 0.667)
        public static let cyan = Color(red: 0.549, green: 0.984, blue: 1.0)
        public static let electricBlue = Color(red: 0.188, green: 0.835, blue: 1.0)
        public static let deepBlue = Color(red: 0.0, green: 0.4, blue: 1.0)
        public static let quietBlue = Color(red: 0.188, green: 0.835, blue: 1.0).opacity(0.12)

        // Sprint 8.2 — paleta gamification por raridade + categoria
        public static let rarityCommon = Color(white: 0.78)
        public static let rarityUncommon = Color(red: 0.20, green: 0.83, blue: 0.60)   // green-400
        public static let rarityRare = electricBlue
        public static let rarityEpic = Color(red: 0.66, green: 0.55, blue: 0.98)        // purple-400
        public static let rarityLegendary = Color(red: 0.98, green: 0.75, blue: 0.14)   // gold-400

        // Sprint 8.2 — challenge difficulty tones
        public static let difficultyEasy = Color(red: 0.13, green: 0.83, blue: 0.93)    // cyan-400
        public static let difficultyMedium = electricBlue
        public static let difficultyHard = rarityEpic
        public static let difficultyLegendary = rarityLegendary
    }

    public enum Spacing {
        public static let xxs: CGFloat = 4
        public static let xs: CGFloat = 8
        public static let sm: CGFloat = 12
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 20
        public static let xl: CGFloat = 24
        public static let xxl: CGFloat = 32
    }

    public enum Radius {
        public static let control: CGFloat = 20
        public static let card: CGFloat = 24
        public static let panel: CGFloat = 32
    }

    public enum Motion {
        public static let quick = Animation.easeOut(duration: 0.16)
        public static let smooth = Animation.interpolatingSpring(stiffness: 180, damping: 22)
    }
}

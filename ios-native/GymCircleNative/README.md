# Gym Circle Native SwiftUI

This is a parallel SwiftUI foundation for Gym Circle. It does not replace the current production Capacitor app.

## Status

- Read-only foundation.
- Uses the same Supabase project and RPC names.
- No secrets are committed.
- No database changes are required.

## Local Setup

1. Copy `Config/Secrets.example.xcconfig` to a local, untracked secrets file.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` locally in Xcode build settings.
3. Open this folder in Xcode as a Swift package or attach it to a future iOS SwiftUI app target.

## Production Safety

Do not edit `ios/App` for this experiment. The current App Store app remains the Capacitor app.

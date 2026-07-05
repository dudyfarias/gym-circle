import Capacitor

/// Registra plugins que vivem dentro do target do app (não em um pacote npm).
final class GymCircleBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GymCircleWorkoutLocationPlugin())
    }
}

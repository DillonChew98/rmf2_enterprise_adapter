use async_trait::async_trait;

use crate::device::model::{MachineConnection, MachineState, MixPreset};
use crate::jobs::model::DelayeringJobRequest;

/// Result of asking the device to run a job.
pub enum SubmitOutcome {
    /// Forwarded to the device (it is idle and will start executing).
    Accepted,
    /// The device is busy executing another job — rejected.
    Busy(String),
    /// The device is offline / unreachable — cannot run anything.
    Unavailable(String),
}

/// The controller's view of the delayering machine. `MqttDevice` implements it
/// over the RMF2 connection/state/request contract; a future AMQP-backed device
/// would implement the same trait without changing the REST layer.
#[async_trait]
pub trait Device: Send + Sync {
    async fn submit(&self, job: &DelayeringJobRequest) -> SubmitOutcome;
    async fn state(&self) -> MachineState;
    async fn connection(&self) -> MachineConnection;
    /// The device's saved mix presets.
    async fn mix_presets(&self) -> Vec<MixPreset>;
    /// Ask the device to save a new mix preset.
    async fn save_mix(&self, preset: &MixPreset) -> SubmitOutcome;
}

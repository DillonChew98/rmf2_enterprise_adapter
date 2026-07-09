/// RMF2 device topics for the delayering machine, MQTT (slash-separated) form:
/// `device/v1/<manufacturer>/<deviceId>/{connection,state,request}`.
/// (The RMF2 AMQP contract is dot-separated; MQTT bridges use slashes.)
#[derive(Clone, Debug)]
pub struct MachineTopics {
    pub connection: String,
    pub state: String,
    pub request: String,
    /// Device publishes its mix-preset list here (retained).
    pub mixes: String,
    /// FCS publishes a new mix preset to save here.
    pub mixes_save: String,
}

impl MachineTopics {
    pub fn new(manufacturer: &str, device_id: &str) -> Self {
        let base = format!("device/v1/{manufacturer}/{device_id}");
        Self {
            connection: format!("{base}/connection"),
            state: format!("{base}/state"),
            request: format!("{base}/request"),
            mixes: format!("{base}/mixes"),
            mixes_save: format!("{base}/mixes/save"),
        }
    }
}

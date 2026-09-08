/// RMF2 device topics for the delayering machine, MQTT (slash-separated) form:
/// `device/v1/<manufacturer>/<deviceId>/{connection,state,request}`.
/// (The RMF2 AMQP contract is dot-separated; MQTT bridges use slashes.)
#[derive(Clone, Debug)]
pub struct MachineTopics {
    pub connection: String,
    pub state: String,
    pub request: String,
    /// Device publishes its recipe list here (retained).
    pub recipes: String,
    /// FCS publishes a new recipe to save here.
    pub recipes_save: String,
}

impl MachineTopics {
    pub fn new(manufacturer: &str, device_id: &str) -> Self {
        let base = format!("device/v1/{manufacturer}/{device_id}");
        Self {
            connection: format!("{base}/connection"),
            state: format!("{base}/state"),
            request: format!("{base}/request"),
            recipes: format!("{base}/recipes"),
            recipes_save: format!("{base}/recipes/save"),
        }
    }
}

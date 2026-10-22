use uuid::Uuid;

use crate::types::Id;

/// Placeholder namespace for seeded rows until the server fixes the shared
/// one; swap it here and every seeded id follows.
const SEED_NAMESPACE: Uuid = Uuid::from_u128(0x6b1f_3c2e_5a7d_4e90_8c41_2d9a_7f03_b5e6);

/// Where seeded defaults belong: one account, or a device that is signed out.
#[derive(Debug, Clone, Copy)]
pub enum SeedScope<'a> {
    Account(&'a str),
    Local,
}

/// The id of a default every account starts with (a ritual template, say):
/// a name-based UUID from its scope and kind, so every device and the server
/// derive the same one without coordinating.
pub fn seed_id(scope: SeedScope, kind: &str) -> Id {
    let scope = match scope {
        SeedScope::Account(account) => account,
        SeedScope::Local => "local",
    };
    Id::from(Uuid::new_v5(
        &SEED_NAMESPACE,
        format!("{scope}/{kind}").as_bytes(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_default_gets_the_same_id_everywhere() {
        let account = SeedScope::Account("0192f0c1-7a2b-7c3d-8e4f-0123456789ab");
        assert_eq!(
            seed_id(account, "ritual/morning"),
            seed_id(account, "ritual/morning")
        );
        assert_ne!(
            seed_id(account, "ritual/morning"),
            seed_id(account, "ritual/evening")
        );
        assert_ne!(
            seed_id(account, "ritual/morning"),
            seed_id(SeedScope::Local, "ritual/morning")
        );
    }
}

use uuid::Uuid;

use crate::types::Id;

/// The namespace of defaults on a device that never signed in.
const LOCAL_NAMESPACE: Uuid = Uuid::from_u128(0x6b1f_3c2e_5a7d_4e90_8c41_2d9a_7f03_b5e6);

/// Where seeded defaults belong: one account (its store scope id), or a
/// device that never signed in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeedScope {
    Account(Uuid),
    Local,
}

/// The id of a default every account starts with, such as `ritual/morning`:
/// the RFC 9562 version 5 UUID of `name` in the scope's namespace (the scope
/// id itself for an account). The server seeds with the same formula, so
/// every device and the server agree without coordinating.
pub fn seed_id(scope: SeedScope, name: &str) -> Id {
    let namespace = match scope {
        SeedScope::Account(scope_id) => scope_id,
        SeedScope::Local => LOCAL_NAMESPACE,
    };
    Id::from(Uuid::new_v5(&namespace, name.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCOPE: Uuid = Uuid::from_u128(0x0192_f0c1_7a2b_7c3d_8e4f_0123_4567_89ab);

    #[test]
    fn the_same_default_gets_the_same_id_everywhere() {
        let account = SeedScope::Account(SCOPE);
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

    #[test]
    fn account_seeds_are_version_5_uuids_in_the_scope_namespace() {
        let id = seed_id(SeedScope::Account(SCOPE), "ritual/morning");
        let uuid = Uuid::parse_str(id.as_str()).unwrap();
        assert_eq!(uuid.get_version_num(), 5);
        assert_eq!(uuid, Uuid::new_v5(&SCOPE, b"ritual/morning"));
    }
}

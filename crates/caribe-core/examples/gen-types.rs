//! Generate `packages/web/src/api/types.ts` from the `caribe-core` wire models.
//!
//! Run via `just gen-types`
//! (`cargo run -p caribe-core --example gen-types --features schema`).
//! The models derive `ts_rs::TS` under the `schema` feature; this collects their
//! declarations (serde camelCase honored) into one committed file.

use caribe_core::models::{
    Booking, BookingStatus, Contact, Departure, Destination, NewBooking, NewPackage, Package,
};
use ts_rs::TS;

fn main() {
    let mut out = String::new();
    out.push_str(
        "// AUTO-GENERATED — do not edit by hand.\n\
         // Source of truth: crates/caribe-core/src/models.rs.\n\
         // Regenerate with `just gen-types`.\n\n",
    );

    // Order so referenced types are declared before their users.
    let decls = [
        Destination::decl(),
        BookingStatus::decl(),
        Departure::decl(),
        Contact::decl(),
        Package::decl(),
        Booking::decl(),
        NewPackage::decl(),
        NewBooking::decl(),
    ];
    for decl in decls {
        out.push_str("export ");
        out.push_str(&decl);
        out.push_str("\n\n");
    }
    // `UpdatePackage` is a Rust type alias of `NewPackage`; mirror that in TS.
    out.push_str("export type UpdatePackage = NewPackage;\n");

    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../packages/web/src/api/types.ts"
    );
    std::fs::write(path, out).expect("write types.ts");
    println!("wrote {path}");
}

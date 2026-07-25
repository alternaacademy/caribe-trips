// AUTO-GENERATED — do not edit by hand.
// Source of truth: crates/caribe-core/src/models.rs.
// Regenerate with `just gen-types`.

export type Destination = "PuntaCana" | "Samana" | "Bayahibe" | "LaRomana" | "Constanza" | "Jarabacoa" | "PuertoPlata" | "Barahona" | "Habana" | "Varadero" | "SanJuan" | "Vieques" | "MontegoBay" | "Negril" | "PortAuPrince" | "Nassau" | "Exuma" | "ProvidencialesTC" | "Aruba" | "Curazao" | "Barbados" | "SantaLucia" | "Granada" | "Martinica" | "Guadalupe" | "SanMartin" | "Dominica" | "Antigua" | "Tobago" | "Cartagena" | "SanAndres" | "Roatan" | "Belice" | "Tulum" | "BocasDelToro";

export type BookingStatus = "Pendiente" | "Confirmada";

export type Departure = { date: string, price: number, };

export type Contact = { name: string, phone: string, email: string, };

export type Package = { id: string | null, title: string, destination: Destination, heroImage: string, gallery: Array<string>, shortPitch: string, descriptionMd: string, included: Array<string>, notIncluded: Array<string>, departures: Array<Departure>, priceFrom: number, featured: boolean, };

export type Booking = { id: string | null, code: string, packageId: string, departureDate: string, people: number, total: number, contact: Contact, status: BookingStatus, createdAt: string, };

export type NewPackage = { title: string, destination: Destination, heroImage: string, gallery: Array<string>, shortPitch: string, descriptionMd: string, included: Array<string>, notIncluded: Array<string>, departures: Array<Departure>, featured: boolean, };

export type NewBooking = { packageId: string, departureDate: string, people: number, contact: Contact, };

export type UpdatePackage = NewPackage;

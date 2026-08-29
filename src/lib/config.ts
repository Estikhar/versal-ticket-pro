export const EVENT = {
  name: process.env.NEXT_PUBLIC_EVENT_NAME ?? "A for Amitabh",
  subtitle: process.env.NEXT_PUBLIC_EVENT_SUBTITLE ?? "The Vvineet Chaudhary Show",
  venue: process.env.NEXT_PUBLIC_VENUE ?? "Inder Dass Auditorium",
  date: process.env.NEXT_PUBLIC_EVENT_DATE ?? "11 Oct 2026",
  time: process.env.NEXT_PUBLIC_EVENT_TIME ?? "4:46 PM Onwards",
  mapsUrl: process.env.NEXT_PUBLIC_MAPS_URL ?? "",
  upiId: process.env.NEXT_PUBLIC_UPI_ID ?? "",
  verifyHours: process.env.NEXT_PUBLIC_VERIFY_HOURS ?? "2",
};
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

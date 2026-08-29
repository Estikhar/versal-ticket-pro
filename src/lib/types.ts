/** Status strings are the Python constants verbatim — the sheet/table stores these. */
export const AVAILABLE = "Available";
export const PENDING = "Pending_Verification";
export const BOOKED = "Booked";
export type SeatStatus = typeof AVAILABLE | typeof PENDING | typeof BOOKED;

export interface SeatRecord {
  seat_id: string;
  status: SeatStatus;
  name: string;
  phone: string;
  utr_number: string;
  booked_at: string;
  checkin_time: string;
}

import { request } from './client';
import type { Booking, BookingStatus, NewBooking } from './types';

export const createBooking = (body: NewBooking): Promise<Booking> =>
  request('POST', '/bookings', body);

export const listBookings = (status?: BookingStatus): Promise<Booking[]> =>
  request('GET', `/bookings${status ? `?status=${status}` : ''}`);

export const getBookingByCode = (code: string): Promise<Booking> =>
  request('GET', `/bookings/${code}`);

export const confirmBooking = (id: string): Promise<Booking> =>
  request('POST', `/bookings/${id}/confirm`);

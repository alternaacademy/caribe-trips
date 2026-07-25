import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmBooking, createBooking, getBookingByCode, listBookings } from './bookings';
import { queryKeys } from './keys';
import {
  type PackageListParams,
  createPackage,
  deletePackage,
  getPackage,
  listPackages,
  updatePackage,
} from './packages';
import { recommend } from './recommend';
import type { BookingStatus, NewPackage, UpdatePackage } from './types';

/* ── Queries ──────────────────────────────────────────────────────────── */

export function usePackages(params: PackageListParams = {}) {
  return useQuery({
    queryKey: queryKeys.packages(params),
    queryFn: () => listPackages(params),
  });
}

export function usePackage(id: string) {
  return useQuery({
    queryKey: queryKeys.package(id),
    queryFn: () => getPackage(id),
    enabled: id.length > 0,
  });
}

export function useBookings(status?: BookingStatus) {
  return useQuery({
    queryKey: queryKeys.bookings(status),
    queryFn: () => listBookings(status),
  });
}

export function useBookingByCode(code: string) {
  return useQuery({
    queryKey: queryKeys.booking(code),
    queryFn: () => getBookingByCode(code),
    enabled: code.length > 0,
  });
}

/* ── Mutations ────────────────────────────────────────────────────────── */

/** The AI concierge. A mutation, not a query: it's an explicit, expensive
 *  (~15 s) action the traveler triggers, never something that fires on typing. */
export function useRecommend() {
  return useMutation({ mutationFn: recommend });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => confirmBooking(id),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: queryKeys.booking(booking.code) });
    },
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewPackage) => createPackage(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
    },
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePackage }) => updatePackage(id, body),
    onSuccess: (pkg) => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      if (pkg.id) qc.invalidateQueries({ queryKey: queryKeys.package(pkg.id) });
    },
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
    },
  });
}

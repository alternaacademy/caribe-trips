import { queryString, request } from './client';
import type { NewPackage, Package, UpdatePackage } from './types';

/** Filters for the package list endpoint. */
export interface PackageListParams {
  destination?: string;
  q?: string;
}

export const listPackages = (params: PackageListParams = {}): Promise<Package[]> =>
  request('GET', `/packages${queryString({ destination: params.destination, q: params.q })}`);

export const getPackage = (id: string): Promise<Package> => request('GET', `/packages/${id}`);

export const createPackage = (body: NewPackage): Promise<Package> =>
  request('POST', '/packages', body);

export const updatePackage = (id: string, body: UpdatePackage): Promise<Package> =>
  request('PUT', `/packages/${id}`, body);

export const deletePackage = (id: string): Promise<void> => request('DELETE', `/packages/${id}`);

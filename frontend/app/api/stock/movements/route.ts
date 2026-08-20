import { NextRequest } from 'next/server';
import { proxyBackendGet } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendGet(request, '/stock/movements');
}

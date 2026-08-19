import { NextRequest } from 'next/server';
import { proxyBackendGet } from '@/lib/api-proxy';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendGet(request, `/products/${params.id}/ficha-tecnica`);
}

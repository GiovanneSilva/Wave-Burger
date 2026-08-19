import { NextRequest } from 'next/server';
import { proxyBackendGet, proxyBackendMutation } from '@/lib/api-proxy';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendGet(request, `/products/${params.id}/ficha-tecnica`);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendMutation(request, `/products/${params.id}/ficha-tecnica`, 'POST');
}

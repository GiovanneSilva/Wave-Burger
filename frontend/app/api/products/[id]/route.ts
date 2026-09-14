import { NextRequest } from 'next/server';
import { proxyBackendGet, proxyBackendMutation } from '@/lib/api-proxy';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendGet(request, `/products/${params.id}`);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendMutation(request, `/products/${params.id}`, 'PATCH');
}

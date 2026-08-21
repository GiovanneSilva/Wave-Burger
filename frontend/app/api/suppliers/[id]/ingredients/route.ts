import { NextRequest } from 'next/server';
import { proxyBackendGet, proxyBackendMutation } from '@/lib/api-proxy';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendGet(request, `/suppliers/${params.id}/ingredients`);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyBackendMutation(request, `/suppliers/${params.id}/ingredients`, 'POST');
}

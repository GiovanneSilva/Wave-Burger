import { NextRequest } from 'next/server';
import { proxyBackendGet, proxyBackendMutation } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendGet(request, '/ifood/settings');
}

export async function PUT(request: NextRequest) {
  return proxyBackendMutation(request, '/ifood/settings', 'PUT');
}

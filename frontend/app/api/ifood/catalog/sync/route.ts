import { NextRequest } from 'next/server';
import { proxyBackendMutation } from '@/lib/api-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendMutation(request, '/ifood/catalog/sync', 'POST');
}

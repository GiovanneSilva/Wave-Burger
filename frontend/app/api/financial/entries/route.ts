import { NextRequest } from 'next/server';
import { proxyBackendGet, proxyBackendMutation } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  return proxyBackendGet(request, '/financial/entries');
}

export async function POST(request: NextRequest) {
  return proxyBackendMutation(request, '/financial/entries', 'POST');
}

import { NextRequest } from 'next/server';
import { proxyBackendMutation } from '@/lib/api-proxy';

export async function POST(request: NextRequest) {
  return proxyBackendMutation(request, '/stock/adjustments', 'POST');
}

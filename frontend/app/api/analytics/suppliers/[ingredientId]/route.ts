import { NextRequest } from 'next/server';
import { proxyBackendGet } from '@/lib/api-proxy';

export async function GET(request: NextRequest, { params }: { params: { ingredientId: string } }) {
  return proxyBackendGet(request, `/analytics/suppliers/${params.ingredientId}`);
}

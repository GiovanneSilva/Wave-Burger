import { NextRequest } from 'next/server';
import { proxyBackendMutation } from '@/lib/api-proxy';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; ingredientId: string } },
) {
  return proxyBackendMutation(request, `/suppliers/${params.id}/ingredients/${params.ingredientId}`, 'DELETE');
}

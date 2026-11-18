import { Env } from '../../types';
import { clearAuthCookie } from '../../utils/crypto';

export const onRequestPost: PagesFunction<Env> = async () => {
  return new Response(
    JSON.stringify({ success: true, message: 'Logged out successfully' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearAuthCookie(),
      },
    }
  );
};

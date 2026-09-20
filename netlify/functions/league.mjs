import { createService } from '../../server/service.mjs';
import { netlifyStore } from '../../server/store.mjs';
import { extractScoreboard } from '../../server/ocr.mjs';

export default async (request, context) => {
  try {
    return await createService({
      store: netlifyStore(context),
      extract: extractScoreboard,
    })(request, context);
  } catch (error) {
    console.error('League storage initialization:', error.message);
    return Response.json(
      {
        error:
          'Shared league storage is unavailable. Deploy the repository through Netlify, including Functions, then refresh.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
};

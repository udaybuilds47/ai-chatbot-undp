import { customProvider } from 'ai';
import { PerplexityAI } from '@perplexity/sdk';
import { isTestEnvironment } from '../constants';
import { chatModel, titleModel, artifactModel } from './models.test';

const perplexity = new PerplexityAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'perplexity-deep-research': chatModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'perplexity-deep-research': perplexity.model('pplx-70b-online'),
        'title-model': perplexity.model('pplx-70b-online'),
        'artifact-model': perplexity.model('pplx-70b-online'),
      },
    });

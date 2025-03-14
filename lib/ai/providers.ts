import { customProvider } from 'ai';
import { perplexity } from '@ai-sdk/perplexity';
import { isTestEnvironment } from '../constants';
import { chatModel, titleModel, artifactModel } from './models.test';

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
        'perplexity-deep-research': perplexity('sonar-pro'),
        'title-model': perplexity('sonar-pro'),
        'artifact-model': perplexity('sonar-pro'),
      },
    });

export const DEFAULT_CHAT_MODEL: string = 'perplexity-deep-research';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'perplexity-deep-research',
    name: 'Perplexity Sonar Pro',
    description: 'Advanced model with real-time sources',
  }
];

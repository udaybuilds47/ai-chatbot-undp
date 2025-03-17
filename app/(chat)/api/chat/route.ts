import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    console.log('Received chat request');
    
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<Message>;
      selectedChatModel: string;
    } = body;

    // Validate required fields
    if (!id) {
      console.error('Missing id in request');
      return NextResponse.json({ 
        error: 'Missing required field: id' 
      }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid or missing messages array');
      return NextResponse.json({ 
        error: 'Missing or invalid messages array' 
      }, { status: 400 });
    }

    if (!selectedChatModel) {
      console.error('Missing selectedChatModel');
      return NextResponse.json({ 
        error: 'Missing required field: selectedChatModel' 
      }, { status: 400 });
    }

    console.log('Selected model:', selectedChatModel);

    if (selectedChatModel !== 'perplexity-deep-research') {
      console.error('Invalid model selected:', selectedChatModel);
      return NextResponse.json({ 
        error: 'Invalid model selected. Expected: perplexity-deep-research' 
      }, { status: 400 });
    }

    const session = await auth();
    console.log('Auth session:', session ? 'Authenticated' : 'Not authenticated');

    if (!session || !session.user || !session.user.id) {
      console.error('Unauthorized request');
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);
    console.log('User message:', userMessage ? 'Found' : 'Not found');

    if (!userMessage) {
      console.error('No user message found in messages array');
      return NextResponse.json({ 
        error: 'No user message found in messages array',
        messages: messages 
      }, { status: 400 });
    }

    const chat = await getChatById({ id });
    console.log('Existing chat:', chat ? 'Found' : 'Not found');

    if (!chat) {
      console.log('Creating new chat with title');
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        console.error('Unauthorized access to chat');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    console.log('Saving user message');
    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });

    return createDataStreamResponse({
      execute: (dataStream) => {
        console.log('Starting chat stream');
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'perplexity-deep-research'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response, reasoning }) => {
            console.log('Chat stream finished');
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
                console.log('Saved response messages');
              } catch (error) {
                console.error('Failed to save chat:', error);
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error('Stream error:', error);
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}

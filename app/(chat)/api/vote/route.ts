import { auth } from '@/app/(auth)/auth';
import { getChatById, getVotesByChatId, voteMessage } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    console.log('Received vote GET request');
    
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    console.log('Request params:', { chatId });

    if (!chatId) {
      console.error('Missing chatId in request');
      return NextResponse.json({ 
        error: 'chatId is required' 
      }, { status: 400 });
    }

    const session = await auth();
    console.log('Auth session:', session ? 'Authenticated' : 'Not authenticated');

    if (!session || !session.user || !session.user.email) {
      console.error('Unauthorized request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const chat = await getChatById({ id: chatId });
    console.log('Existing chat:', chat ? 'Found' : 'Not found');

    if (!chat) {
      console.log('Chat not found, returning empty votes array');
      return NextResponse.json([], { status: 200 });
    }

    if (chat.userId !== session.user.id) {
      console.error('Unauthorized access to chat');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('Fetching votes for chat:', chatId);
    const votes = await getVotesByChatId({ id: chatId });
    console.log('Votes found:', votes.length);

    return NextResponse.json(votes, { status: 200 });
  } catch (error) {
    console.error('Vote GET API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    console.log('Received vote PATCH request');
    
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const {
      chatId,
      messageId,
      type,
    }: { chatId: string; messageId: string; type: 'up' | 'down' } = body;

    // Validate required fields
    if (!chatId) {
      console.error('Missing chatId in request');
      return NextResponse.json({ 
        error: 'chatId is required' 
      }, { status: 400 });
    }

    if (!messageId) {
      console.error('Missing messageId in request');
      return NextResponse.json({ 
        error: 'messageId is required' 
      }, { status: 400 });
    }

    if (!type || !['up', 'down'].includes(type)) {
      console.error('Invalid or missing vote type:', type);
      return NextResponse.json({ 
        error: 'type must be either "up" or "down"' 
      }, { status: 400 });
    }

    const session = await auth();
    console.log('Auth session:', session ? 'Authenticated' : 'Not authenticated');

    if (!session || !session.user || !session.user.email) {
      console.error('Unauthorized request');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const chat = await getChatById({ id: chatId });
    console.log('Existing chat:', chat ? 'Found' : 'Not found');

    if (!chat) {
      console.error('Chat not found:', chatId);
      return NextResponse.json({ 
        error: 'Chat not found' 
      }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      console.error('Unauthorized access to chat');
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('Processing vote:', { chatId, messageId, type });
    await voteMessage({
      chatId,
      messageId,
      type: type,
    });
    console.log('Vote processed successfully');

    return NextResponse.json({ 
      message: 'Message voted successfully' 
    }, { status: 200 });
  } catch (error) {
    console.error('Vote PATCH API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

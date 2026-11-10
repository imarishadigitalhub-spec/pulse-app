import { readFile } from 'node:fs/promises';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

const projectId = 'demo-pulse-rules';
const conversationId = 'conversation-test';
const originalMessageId = 'original-message';

let env;
let aliceDb;
let bobDb;
let outsiderDb;

const originalMessage = {
  senderId: 'alice',
  text: 'Original message for reply testing',
  type: 'text',
  createdAt: new Date(),
};

function replyMessage(overrides = {}) {
  return {
    senderId: 'bob',
    text: 'This is a reply',
    type: 'text',
    createdAt: new Date(),
    replyTo: {
      messageId: originalMessageId,
      senderId: 'alice',
      senderName: 'Alice',
      text: originalMessage.text,
      type: 'text',
    },
    ...overrides,
  };
}

before(async () => {
  const rules = await readFile(
    new URL('../firestore.rules', import.meta.url),
    'utf8',
  );

  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules,
    },
  });

  aliceDb = env.authenticatedContext('alice').firestore();
  bobDb = env.authenticatedContext('bob').firestore();
  outsiderDb = env.authenticatedContext('outsider').firestore();
});

beforeEach(async () => {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();

    await firestore.doc(`conversations/${conversationId}`).set({
      participants: ['alice', 'bob'],
      type: 'direct',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await firestore
      .doc(`conversations/${conversationId}/messages/${originalMessageId}`)
      .set(originalMessage);
  });
});

after(async () => {
  await env?.cleanup();
});

test('participant can create and update their own reaction', async () => {
  const reactionRef = aliceDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/alice`,
  );

  await assertSucceeds(reactionRef.set({
    uid: 'alice',
    emoji: '👍',
    updatedAt: new Date(),
  }));

  await assertSucceeds(reactionRef.set({
    uid: 'alice',
    emoji: '❤️',
    updatedAt: new Date(),
  }));
});

test('participant can delete their own reaction', async () => {
  const reactionRef = aliceDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/alice`,
  );

  await assertSucceeds(reactionRef.set({
    uid: 'alice',
    emoji: '👍',
    updatedAt: new Date(),
  }));

  await assertSucceeds(reactionRef.delete());
});

test('participant cannot create a reaction owned by another user', async () => {
  const reactionRef = aliceDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/bob`,
  );

  await assertFails(reactionRef.set({
    uid: 'bob',
    emoji: '👍',
    updatedAt: new Date(),
  }));
});

test('invalid reaction emoji is rejected', async () => {
  const reactionRef = aliceDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/alice`,
  );

  await assertFails(reactionRef.set({
    uid: 'alice',
    emoji: '🔥',
    updatedAt: new Date(),
  }));
});

test('non-participant cannot read message reactions', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore()
      .doc(`conversations/${conversationId}/messages/${originalMessageId}/reactions/alice`)
      .set({
        uid: 'alice',
        emoji: '👍',
        updatedAt: new Date(),
      });
  });

  const reactionRef = outsiderDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/alice`,
  );

  await assertFails(reactionRef.get());
});

test('non-participant cannot create a reaction', async () => {
  const reactionRef = outsiderDb.doc(
    `conversations/${conversationId}/messages/${originalMessageId}/reactions/outsider`,
  );

  await assertFails(reactionRef.set({
    uid: 'outsider',
    emoji: '👍',
    updatedAt: new Date(),
  }));
});

test('participant can reply using an exact original-message snapshot', async () => {
  const replyRef = bobDb.doc(
    `conversations/${conversationId}/messages/valid-reply`,
  );

  await assertSucceeds(replyRef.set(replyMessage()));
});

test('fabricated quoted text is rejected', async () => {
  const replyRef = bobDb.doc(
    `conversations/${conversationId}/messages/fabricated-reply`,
  );

  await assertFails(replyRef.set(replyMessage({
    replyTo: {
      messageId: originalMessageId,
      senderId: 'alice',
      senderName: 'Alice',
      text: 'This text was never sent',
      type: 'text',
    },
  })));
});

test('reply to a nonexistent original message is rejected', async () => {
  const replyRef = bobDb.doc(
    `conversations/${conversationId}/messages/missing-original-reply`,
  );

  await assertFails(replyRef.set(replyMessage({
    replyTo: {
      messageId: 'does-not-exist',
      senderId: 'alice',
      senderName: 'Alice',
      text: originalMessage.text,
      type: 'text',
    },
  })));
});
